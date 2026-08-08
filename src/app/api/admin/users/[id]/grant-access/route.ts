import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import mongoose from "mongoose";
import Course from "@/models/Course";
import { logActivity } from "@/lib/activity";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        // Verify admin
        const cookieStore = await cookies();
        const token = cookieStore.get("session_token")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const payload = verifyToken(token);
        if (!payload || payload.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id: userId } = await params;
        const { courseId } = await req.json();

        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(courseId)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        await dbConnect();

        // Add course to user's unlockedCourses (if not already there)
        const user = await User.findByIdAndUpdate(
            userId,
            { $addToSet: { unlockedCourses: courseId } },
            { new: true }
        ).populate("unlockedCourses", "title");

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const grantedCourse = await Course.findById(courseId).select("title").lean();
        await logActivity({
            type: "access_granted_manual",
            description: `Admin granted ${user.name} access to ${(grantedCourse as { title?: string } | null)?.title || "a course"}`,
            userId,
            userName: user.name,
            userEmail: user.email,
            metadata: { courseId, courseTitle: (grantedCourse as { title?: string } | null)?.title, actedByAdminId: payload.userId },
            req,
        });

        return NextResponse.json({ success: true, user });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

// Remove course access
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("session_token")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const payload = verifyToken(token);
        if (!payload || payload.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id: userId } = await params;
        const { courseId } = await req.json();

        await dbConnect();

        const user = await User.findByIdAndUpdate(
            userId,
            { $pull: { unlockedCourses: courseId } },
            { new: true }
        );

        const revokedCourse = await Course.findById(courseId).select("title").lean();
        await logActivity({
            type: "access_revoked_manual",
            description: `Admin revoked ${user?.name || "a user"}'s access to ${(revokedCourse as { title?: string } | null)?.title || "a course"}`,
            userId,
            userName: user?.name,
            userEmail: user?.email,
            metadata: { courseId, courseTitle: (revokedCourse as { title?: string } | null)?.title, actedByAdminId: payload.userId },
            req,
        });

        return NextResponse.json({ success: true, user });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
