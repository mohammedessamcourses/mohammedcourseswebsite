import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import AccessRequest from "@/models/AccessRequest";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { logActivity } from "@/lib/activity";
import User from "@/models/User";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("session_token")?.value;

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: courseId } = await params;
        const { fullName, phoneNumber, transactionNotes } = await req.json();

        if (!fullName || !phoneNumber) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        await dbConnect();

        // Check for existing pending request
        const existing = await AccessRequest.findOne({
            userId: payload.userId,
            courseId,
            status: "pending",
        });

        if (existing) {
            return NextResponse.json(
                { error: "Pending request already exists" },
                { status: 400 }
            );
        }

        // Fetch Course to get current price
        const Course = (await import("@/models/Course")).default;
        const course = await Course.findById(courseId);
        if (!course) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        const request = await AccessRequest.create({
            userId: payload.userId,
            courseId,
            status: "pending",
            paymentDetails: {
                fullName,
                phoneNumber,
                transactionNotes,
                amount: course.isFree ? 0 : course.price
            },
        });

        const requester = await User.findById(payload.userId).select("name email").lean();

        await logActivity({
            type: "access_requested",
            description: `${fullName} requested access to ${course.title}`,
            userId: payload.userId,
            userName: (requester as { name?: string } | null)?.name || fullName,
            userEmail: (requester as { email?: string } | null)?.email,
            metadata: {
                courseId,
                courseTitle: course.title,
                amount: course.isFree ? 0 : course.price,
                phoneNumber,
            },
            req,
        });

        return NextResponse.json({ request }, { status: 201 });
    } catch (error) {
        console.error("Unlock Request Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
