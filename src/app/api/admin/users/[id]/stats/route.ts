import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import { calculateLevel } from "@/lib/gamification";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("session_token")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const payload = verifyToken(token);
        if (!payload || payload.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id: userId } = await params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const body = await req.json();
        const { xpDelta, xpTotal, streakCount, lastActiveDate } = body || {};

        await dbConnect();
        const user = await User.findById(userId);
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        if (typeof xpDelta === "number") {
            user.xp = (user.xp || 0) + xpDelta;
        }

        if (typeof xpTotal === "number") {
            user.xp = xpTotal;
        }

        user.level = calculateLevel(user.xp || 0);

        if (typeof streakCount === "number") {
            const defaultLastActiveDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            user.streak = {
                count: Math.max(0, streakCount),
                lastActiveDate: lastActiveDate ? new Date(lastActiveDate) : defaultLastActiveDate,
            };
        }

        await user.save();

        return NextResponse.json({ success: true, user });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
