import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ActivityLog from "@/models/ActivityLog";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { ACTIVITY_TIMEZONE, NON_ENGAGEMENT_TYPES, getActivityMeta } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Local calendar date (YYYY-MM-DD) for an instant, in the activity timezone. */
function dayKey(date: Date): string {
    // en-CA formats as YYYY-MM-DD, which sorts lexicographically.
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: ACTIVITY_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

/** The last `count` day keys, oldest first, ending today. */
function recentDayKeys(count: number): string[] {
    const keys: string[] = [];
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        keys.push(dayKey(d));
    }
    return keys;
}

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        let token = cookieStore.get("session_token")?.value;
        if (!token) {
            const authHeader = req.headers.get("Authorization");
            if (authHeader?.startsWith("Bearer ")) token = authHeader.split(" ")[1];
        }
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const payload = verifyToken(token);
        if (!payload || payload.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await dbConnect();

        const { searchParams } = new URL(req.url);
        const rangeParam = Number(searchParams.get("days") || "30");
        const rangeDays = Number.isFinite(rangeParam) ? Math.min(Math.max(rangeParam, 7), 90) : 30;

        // Widen the scan by two days so timezone offsets can't clip the oldest bucket.
        const since = new Date();
        since.setDate(since.getDate() - (rangeDays + 2));
        since.setHours(0, 0, 0, 0);

        const dayExpr = {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: ACTIVITY_TIMEZONE },
        };

        const [facet] = await ActivityLog.aggregate([
            { $match: { createdAt: { $gte: since } } },
            { $addFields: { day: dayExpr } },
            {
                $facet: {
                    // Every event counts toward volume, including failed logins.
                    dailyEvents: [{ $group: { _id: "$day", events: { $sum: 1 } } }],
                    // Active-user buckets exclude unverified actors (see NON_ENGAGEMENT_TYPES).
                    dailyUsers: [
                        { $match: { type: { $nin: NON_ENGAGEMENT_TYPES }, userId: { $ne: null } } },
                        { $group: { _id: "$day", users: { $addToSet: { $toString: "$userId" } } } },
                    ],
                    byType: [{ $group: { _id: "$type", count: { $sum: 1 } } }, { $sort: { count: -1 } }],
                    topUsers: [
                        { $match: { userId: { $ne: null } } },
                        {
                            $group: {
                                _id: { $toString: "$userId" },
                                name: { $last: "$userName" },
                                email: { $last: "$userEmail" },
                                events: { $sum: 1 },
                                lastSeen: { $max: "$createdAt" },
                            },
                        },
                        { $sort: { events: -1 } },
                        { $limit: 8 },
                    ],
                },
            },
        ]);

        const eventsByDay = new Map<string, number>(
            (facet?.dailyEvents || []).map((d: { _id: string; events: number }) => [d._id, d.events])
        );
        const usersByDay = new Map<string, string[]>(
            (facet?.dailyUsers || []).map((d: { _id: string; users: string[] }) => [d._id, d.users])
        );

        const seriesKeys = recentDayKeys(rangeDays);
        const series = seriesKeys.map((key) => ({
            date: key,
            events: eventsByDay.get(key) || 0,
            activeUsers: (usersByDay.get(key) || []).length,
        }));

        // Distinct users over a window = union of that window's daily sets.
        const distinctOverLastDays = (count: number) => {
            const union = new Set<string>();
            for (const key of recentDayKeys(count)) {
                for (const id of usersByDay.get(key) || []) union.add(id);
            }
            return union.size;
        };

        const todayKey = dayKey(new Date());
        const dau = (usersByDay.get(todayKey) || []).length;
        const wau = distinctOverLastDays(7);
        const mau = distinctOverLastDays(30);

        const byType = (facet?.byType || []).map((t: { _id: string; count: number }) => ({
            type: t._id,
            label: getActivityMeta(t._id).label,
            category: getActivityMeta(t._id).category,
            count: t.count,
        }));

        const topUsers = (facet?.topUsers || []).map(
            (u: { _id: string; name?: string; email?: string; events: number; lastSeen: Date }) => ({
                userId: u._id,
                name: u.name || "Unknown",
                email: u.email || "",
                events: u.events,
                lastSeen: u.lastSeen,
            })
        );

        const [totalEvents, totalUsers, allUsers] = await Promise.all([
            ActivityLog.countDocuments({}),
            User.countDocuments({}),
            User.find({}).select("createdAt").lean(),
        ]);

        const newUsersToday = allUsers.filter(
            (u) => u.createdAt && dayKey(new Date(u.createdAt as unknown as string)) === todayKey
        ).length;

        const eventsToday = eventsByDay.get(todayKey) || 0;
        const rangeEvents = series.reduce((sum, d) => sum + d.events, 0);

        return NextResponse.json({
            timezone: ACTIVITY_TIMEZONE,
            rangeDays,
            totals: {
                dau,
                wau,
                mau,
                eventsToday,
                rangeEvents,
                totalEvents,
                totalUsers,
                newUsersToday,
                // Share of registered users active in the last 30 days.
                stickiness: mau > 0 ? Math.round((dau / mau) * 100) : 0,
            },
            series,
            byType,
            topUsers,
        });
    } catch (e) {
        console.error("Activity Stats Error:", e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
