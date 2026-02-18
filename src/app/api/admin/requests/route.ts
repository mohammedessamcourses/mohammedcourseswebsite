import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import AccessRequest from "@/models/AccessRequest";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        let token = cookieStore.get("session_token")?.value;

        // Fallback: Check Authorization Header
        if (!token) {
            const authHeader = req.headers.get("Authorization");
            if (authHeader?.startsWith("Bearer ")) {
                token = authHeader.split(" ")[1];
            }
        }

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload || payload.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await dbConnect();

        const requests = await AccessRequest.find({})
            .select("userId courseId status paymentDetails createdAt")
            .populate("userId", "name email")
            .populate("courseId", "title price discountPrice discountActive")
            .sort({ createdAt: 1 })
            .lean();

        return NextResponse.json({ requests });
    } catch (error) {
        console.error("Admin Requests List Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
