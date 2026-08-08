import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ActivityLog from "@/models/ActivityLog";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { type QueryFilter } from "mongoose";
import { type IActivityLog } from "@/models/ActivityLog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireAdmin(req: Request) {
    const cookieStore = await cookies();
    let token = cookieStore.get("session_token")?.value;

    if (!token) {
        const authHeader = req.headers.get("Authorization");
        if (authHeader?.startsWith("Bearer ")) token = authHeader.split(" ")[1];
    }

    if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }

    return { payload };
}

export async function GET(req: Request) {
    try {
        const auth = await requireAdmin(req);
        if (auth.error) return auth.error;

        await dbConnect();

        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") || "";
        const search = searchParams.get("search") || "";
        const userId = searchParams.get("userId") || "";
        const days = Number(searchParams.get("days") || "0");

        const limitParam = Number(searchParams.get("limit") || "50");
        const offsetParam = Number(searchParams.get("offset") || "0");
        const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;
        const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;

        const filter: QueryFilter<IActivityLog> = {};

        if (type) filter.type = type;
        if (userId) filter.userId = userId;

        if (Number.isFinite(days) && days > 0) {
            const since = new Date();
            since.setDate(since.getDate() - days);
            filter.createdAt = { $gte: since };
        }

        if (search) {
            // Escape user input so regex metacharacters can't alter the query.
            const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.$or = [
                { description: { $regex: safe, $options: "i" } },
                { userName: { $regex: safe, $options: "i" } },
                { userEmail: { $regex: safe, $options: "i" } },
            ];
        }

        const [logs, totalCount] = await Promise.all([
            ActivityLog.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
            ActivityLog.countDocuments(filter),
        ]);

        return NextResponse.json({ logs, totalCount, limit, offset });
    } catch (e) {
        console.error("Activity Feed Error:", e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

/** Clears activity history. Supports `?days=N` to trim only entries older than N days. */
export async function DELETE(req: Request) {
    try {
        const auth = await requireAdmin(req);
        if (auth.error) return auth.error;

        await dbConnect();

        const { searchParams } = new URL(req.url);
        const olderThanDays = Number(searchParams.get("olderThanDays") || "0");

        const filter: QueryFilter<IActivityLog> = {};
        if (Number.isFinite(olderThanDays) && olderThanDays > 0) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - olderThanDays);
            filter.createdAt = { $lt: cutoff };
        }

        const result = await ActivityLog.deleteMany(filter);
        return NextResponse.json({ success: true, deleted: result.deletedCount ?? 0 });
    } catch (e) {
        console.error("Activity Clear Error:", e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
