import dbConnect from "@/lib/db";
import ActivityLog from "@/models/ActivityLog";
import type { ActivityType } from "@/lib/activity-types";

// Server code reads the vocabulary through this module; client components must
// import from "@/lib/activity-types" directly to stay out of the mongoose graph.
export * from "@/lib/activity-types";

export function getClientIp(req?: Request | null): string | undefined {
    if (!req) return undefined;
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return req.headers.get("x-real-ip") || undefined;
}

interface LogActivityInput {
    type: ActivityType;
    description: string;
    userId?: unknown;
    userName?: string;
    userEmail?: string;
    metadata?: Record<string, unknown>;
    req?: Request | null;
    ip?: string;
}

/**
 * Records one activity event.
 *
 * Never throws: logging is observability, so a logging failure must not turn a
 * successful user action into a 500. Failures are reported to the server console
 * and swallowed.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
    try {
        await dbConnect();
        await ActivityLog.create({
            type: input.type,
            description: input.description,
            userId: input.userId ? String(input.userId) : null,
            userName: input.userName,
            userEmail: input.userEmail,
            metadata: input.metadata || {},
            ip: input.ip ?? getClientIp(input.req),
        });
    } catch (error) {
        console.error(`[ACTIVITY] Failed to log "${input.type}":`, error);
    }
}
