import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import dbConnect from "@/lib/db";
import User from "@/models/User";

export async function POST(req: Request) {
    const cookieStore = await cookies();

    // Resolve who is logging out before the cookie is cleared.
    const token = cookieStore.get("session_token")?.value;
    const payload = token ? verifyToken(token) : null;

    // Force expiration with specific matching attributes
    cookieStore.set("session_token", "", {
        expires: new Date(0),
        path: "/",
        secure: false,
        sameSite: "lax",
        httpOnly: true
    });

    if (payload) {
        try {
            await dbConnect();
            const user = await User.findById(payload.userId).select("name email");
            await logActivity({
                type: "logout",
                description: `${user?.name || "A user"} logged out`,
                userId: payload.userId,
                userName: user?.name,
                userEmail: user?.email,
                req,
            });
        } catch (error) {
            console.error("[ACTIVITY] logout lookup failed:", error);
        }
    }

    return NextResponse.json({ success: true });
}
