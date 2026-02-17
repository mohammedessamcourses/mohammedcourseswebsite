import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { comparePassword, signToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";

const LOGIN_RATE_LIMIT = {
    key: "login",
    maxAttempts: 12,
    windowMs: 15 * 60 * 1000,
};

export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

        // Check rate limit
        const limitStatus = rateLimit.check(ip, LOGIN_RATE_LIMIT);
        if (limitStatus.limited) {
            const remainingMinutes = Math.ceil((limitStatus.resetTime - Date.now()) / 60000);
            return NextResponse.json(
                { error: "Too many login attempts. Please try again in " + remainingMinutes + " minutes." },
                { status: 429 }
            );
        }

        await dbConnect();
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: "Missing email or password" },
                { status: 400 }
            );
        }

        // Connect to DB and find user
        const user = await User.findOne({ email }).select("+password");

        if (!user || !user.password) {
            // Increment rate limit on failure
            rateLimit.increment(ip, LOGIN_RATE_LIMIT);

            return NextResponse.json(
                { error: "Invalid credentials" },
                { status: 401 }
            );
        }

        const isMatch = await comparePassword(password, user.password);

        if (!isMatch) {
            // Increment rate limit on failure
            rateLimit.increment(ip, LOGIN_RATE_LIMIT);

            return NextResponse.json(
                { error: "Invalid credentials" },
                { status: 401 }
            );
        }

        // Reset rate limit on success
        rateLimit.clear(ip, LOGIN_RATE_LIMIT);

        const token = signToken({ userId: user._id as unknown as string, role: user.role });

        (await cookies()).set("session_token", token, {
            httpOnly: true,
            secure: false, // Allow HTTP (local network)
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: "/",
        });

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
        console.error("Login Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
