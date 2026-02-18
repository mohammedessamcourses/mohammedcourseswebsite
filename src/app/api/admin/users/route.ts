
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User, { type IUser } from "@/models/User";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { type FilterQuery } from "mongoose";

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

        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const payload = verifyToken(token);
        if (!payload || payload.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await dbConnect();

        // Get search query from URL
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || "";

        // Build query
        let query: FilterQuery<IUser> = {};
        if (search) {
            query = {
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } }
                ]
            };
        }

        // Check if full details are requested (for Users table vs Analytics/Overview)
        const details = searchParams.get("details");

        let queryBuilder = User.find(query).sort({ createdAt: -1 });

        if (details === "true") {
            queryBuilder = queryBuilder
                .select("name email role xp level streak unlockedCourses completedCourses createdAt")
                .populate("unlockedCourses", "title price isFree")
                .populate("completedCourses", "title");
        } else {
            // Lightweight payload for overview analytics and course dashboard
            queryBuilder = queryBuilder.select("name email unlockedCourses completedCourses createdAt");
        }

        const users = await queryBuilder.lean();

        return NextResponse.json({ users });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
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

        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const payload = verifyToken(token);
        if (!payload || payload.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await req.json();

        await dbConnect();
        await User.findByIdAndDelete(id);

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
