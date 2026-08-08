/**
 * Client-safe activity vocabulary.
 *
 * Kept free of any database import so admin components can render labels and
 * badges without dragging mongoose into the browser bundle. Server-side logging
 * lives in `activity.ts`, which re-exports everything here.
 */

/**
 * Day boundaries for DAU/MAU are computed in this timezone so "today" matches
 * the audience's day rather than UTC. Change here to re-cut every metric.
 */
export const ACTIVITY_TIMEZONE = "Africa/Cairo";

export type ActivityCategory = "auth" | "learning" | "commerce" | "admin" | "system";

export interface ActivityTypeMeta {
    label: string;
    category: ActivityCategory;
    /** Tailwind classes used by the admin feed badges. */
    color: string;
}

export const ACTIVITY_TYPES = {
    login: { label: "Login", category: "auth", color: "bg-primary/15 text-primary border-primary/40" },
    login_failed: { label: "Failed Login", category: "auth", color: "bg-red-500/15 text-red-400 border-red-500/40" },
    logout: { label: "Logout", category: "auth", color: "bg-slate-500/15 text-slate-400 border-slate-500/40" },
    register: { label: "Registered", category: "auth", color: "bg-secondary/15 text-secondary border-secondary/40" },

    section_complete: { label: "Section Complete", category: "learning", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40" },
    course_complete: { label: "Course Complete", category: "learning", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40" },
    quiz_answer: { label: "Quiz Answer", category: "learning", color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/40" },

    access_requested: { label: "Access Requested", category: "commerce", color: "bg-orange-500/15 text-orange-400 border-orange-500/40" },
    access_approved: { label: "Access Approved", category: "commerce", color: "bg-green-500/15 text-green-400 border-green-500/40" },
    access_rejected: { label: "Access Rejected", category: "commerce", color: "bg-red-500/15 text-red-400 border-red-500/40" },

    certificate_requested: { label: "Certificate Requested", category: "commerce", color: "bg-amber-500/15 text-amber-400 border-amber-500/40" },
    certificate_approved: { label: "Certificate Approved", category: "commerce", color: "bg-green-500/15 text-green-400 border-green-500/40" },
    certificate_rejected: { label: "Certificate Rejected", category: "commerce", color: "bg-red-500/15 text-red-400 border-red-500/40" },

    contact_message: { label: "Contact Message", category: "system", color: "bg-blue-500/15 text-blue-400 border-blue-500/40" },

    course_created: { label: "Course Created", category: "admin", color: "bg-purple-500/15 text-purple-400 border-purple-500/40" },
    course_updated: { label: "Course Updated", category: "admin", color: "bg-purple-500/15 text-purple-400 border-purple-500/40" },
    course_deleted: { label: "Course Deleted", category: "admin", color: "bg-red-500/15 text-red-400 border-red-500/40" },
    access_granted_manual: { label: "Access Granted (Admin)", category: "admin", color: "bg-purple-500/15 text-purple-400 border-purple-500/40" },
    access_revoked_manual: { label: "Access Revoked (Admin)", category: "admin", color: "bg-red-500/15 text-red-400 border-red-500/40" },
} as const satisfies Record<string, ActivityTypeMeta>;

export type ActivityType = keyof typeof ACTIVITY_TYPES;

/**
 * Events that must NOT count toward DAU/WAU/MAU. A failed login has no verified
 * actor behind it, so counting it would inflate active users with bad traffic.
 */
export const NON_ENGAGEMENT_TYPES: ActivityType[] = ["login_failed"];

export function getActivityMeta(type: string): ActivityTypeMeta {
    return (
        (ACTIVITY_TYPES as Record<string, ActivityTypeMeta>)[type] ?? {
            label: type,
            category: "system",
            color: "bg-slate-500/15 text-slate-400 border-slate-500/40",
        }
    );
}
