import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";
import { logActivity } from "@/lib/activity";

export async function POST(req: Request) {
    try {
        const { name, phone, message, source } = await req.json();

        if (!name || !phone || !message) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        await dbConnect();

        const created = await ContactMessage.create({
            name: String(name).trim(),
            phone: String(phone).trim(),
            message: String(message).trim(),
            source: source ? String(source).trim() : "tutorial",
        });

        await logActivity({
            type: "contact_message",
            description: `${created.name} sent a contact message from "${created.source}"`,
            userName: created.name,
            metadata: { source: created.source, phone: created.phone, messageId: String(created._id) },
            req,
        });

        return NextResponse.json({ success: true, message: created });
    } catch (error: unknown) {
        const err = error as { message?: string; stack?: string; errors?: unknown };
        console.error("Message Create Error details:", {
            message: err.message,
            stack: err.stack,
            errors: err.errors
        });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
