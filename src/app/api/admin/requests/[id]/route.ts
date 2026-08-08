import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import AccessRequest from "@/models/AccessRequest";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { logActivity } from "@/lib/activity";
import Course from "@/models/Course";

export async function PUT(
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
        if (!payload || payload.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        const { status, adminNotes } = await req.json();

        if (!["approved", "rejected"].includes(status)) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }

        await dbConnect();

        const request = await AccessRequest.findById(id);
        if (!request) {
            return NextResponse.json({ error: "Request not found" }, { status: 404 });
        }

        if (request.status !== "pending") {
            return NextResponse.json(
                { error: "Request already processed" },
                { status: 400 }
            );
        }

        request.status = status;
        request.adminNotes = adminNotes || "";
        await request.save();

        if (status === "approved") {
            // Grant Access
            await User.findByIdAndUpdate(request.userId, {
                $addToSet: { unlockedCourses: request.courseId },
            });
        }

        const [requestUser, requestCourse] = await Promise.all([
            User.findById(request.userId).select("name email").lean(),
            Course.findById(request.courseId).select("title").lean(),
        ]);
        const targetName = (requestUser as { name?: string } | null)?.name || "A user";
        const targetCourse = (requestCourse as { title?: string } | null)?.title || "a course";

        await logActivity({
            type: status === "approved" ? "access_approved" : "access_rejected",
            description: `Admin ${status} ${targetName}'s access request for ${targetCourse}`,
            userId: request.userId,
            userName: targetName,
            userEmail: (requestUser as { email?: string } | null)?.email,
            metadata: {
                requestId: id,
                courseId: String(request.courseId),
                courseTitle: targetCourse,
                status,
                adminNotes: adminNotes || "",
                actedByAdminId: payload.userId,
            },
            req,
        });

        return NextResponse.json({ success: true, request });
    } catch (error) {
        console.error("Admin Request Update Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("session_token")?.value;

        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const payload = verifyToken(token);
        if (!payload || payload.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        await dbConnect();
        await AccessRequest.findByIdAndDelete(id);

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
}
