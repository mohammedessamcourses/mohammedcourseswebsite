import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { hashPassword, signToken, verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";

const REGISTER_RATE_LIMIT = {
    key: "register",
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
};

export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

        const cookieStore = await cookies();
        const existingToken = cookieStore.get("session_token")?.value;
        const existingPayload = existingToken ? verifyToken(existingToken) : null;
        const isAdminCaller = !!existingPayload && existingPayload.role === "admin";

        // Check rate limit for self-service registration to prevent spam.
        // Admin-initiated creations from the dashboard are not rate-limited.
        if (!isAdminCaller) {
            const limitStatus = rateLimit.check(ip, REGISTER_RATE_LIMIT);
            if (limitStatus.limited) {
                const remainingMinutes = Math.ceil((limitStatus.resetTime - Date.now()) / 60000);
                return NextResponse.json(
                    { error: "Too many registration attempts. Please try again in " + remainingMinutes + " minutes." },
                    { status: 429 }
                );
            }
        }

        await dbConnect();
        const { name, email, password, phone, role } = await req.json();

        if (!name || !email || !password || !phone) {
            return NextResponse.json(
                { error: "Missing required fields (Name, Email, Password, and Phone are required)" },
                { status: 400 }
            );
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { error: "Email already registered" },
                { status: 400 }
            );
        }

        const hashedPassword = await hashPassword(password);

        // Role rules:
        // - If called by an authenticated admin (from the admin panel), allow "admin" or "student".
        // - For public/self registration, always force "student" regardless of payload.
        const userRole =
            isAdminCaller && role === "admin"
                ? "admin"
                : "student";

        const user = await User.create({
            name,
            email,
            phone,
            password: hashedPassword,
            role: userRole,
        });

        // Clear rate limit on success for self-service registrations
        if (!isAdminCaller) {
            rateLimit.clear(ip, REGISTER_RATE_LIMIT);

            const token = signToken({ userId: user._id as unknown as string, role: user.role });

            cookieStore.set("session_token", token, {
                httpOnly: true,
                secure: false, // Allow HTTP (local network)
                sameSite: "lax",
                maxAge: 60 * 60 * 24 * 7, // 7 days
                path: "/",
            });
        }

        return NextResponse.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                xp: user.xp,
                level: user.level,
            },
        });
    } catch (error) {
        // Increment rate limit on error to prevent bruteforce/spam
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
        rateLimit.increment(ip, REGISTER_RATE_LIMIT);

        console.error("Register Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
