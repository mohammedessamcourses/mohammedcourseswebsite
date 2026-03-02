
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User, { type IUser } from "@/models/User";
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
        let query: Record<string, unknown> = {};
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
        const limitParam = Number(searchParams.get("limit") || (details === "true" ? "200" : "500"));
        const offsetParam = Number(searchParams.get("offset") || "0");
        const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 2000) : 500;
        const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;

        let queryBuilder: any = User.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit);

        if (details === "true") {
            queryBuilder = queryBuilder
                .select("name email role xp level streak unlockedCourses completedCourses createdAt")
                .populate("unlockedCourses", "title price isFree")
                .populate("completedCourses", "title");
        } else {
            // Lightweight payload for overview analytics and course dashboard
            queryBuilder = queryBuilder.select("name email unlockedCourses completedCourses createdAt");
        }

        const [users, totalCount] = await Promise.all([
            queryBuilder.lean(),
            User.countDocuments(query),
        ]);

        return NextResponse.json({ users, totalCount, limit, offset });
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
    } catch {
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
