import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "jwt_4o3uJ5Kf7Xn2Qv9Pz1Lm6Rs8Tt0Yw3Bh";

// Basic in-memory rate limiting (for single-server/development)
const rateLimit = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100; // 100 requests per minute

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

    // Skip rate limiting for static assets
    const isStatic = pathname.startsWith("/_next") ||
        pathname.startsWith("/api/upload") || // Allow uploads (large files might hit limits)
        pathname.includes(".") ||
        pathname.startsWith("/gifs");

    if (!isStatic) {
        const now = Date.now();
        const userLimit = rateLimit.get(ip);

        if (userLimit && now < userLimit.reset) {
            if (userLimit.count >= MAX_REQUESTS) {
                return new NextResponse("Too Many Requests", { status: 429 });
            }
            userLimit.count++;
        } else {
            rateLimit.set(ip, { count: 1, reset: now + RATE_LIMIT_WINDOW });
        }
    }

    const token = request.cookies.get("session_token")?.value;

    // Protect Admin Routes
    if (pathname.startsWith("/admin")) {
        // ... existing admin logic ...
        // Only block API calls strictly. For page loads, we allow client-side handling to avoid loops if cookies fail.
        if (pathname.startsWith("/api/")) {
            if (!token) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        } else {
            // For UI routes, if no token, allow through so client can handle "Login to Admin"
            // This prevents the redirect loop on deployment
            if (!token) {
                return NextResponse.next();
            }
        }

        try {
            const secret = new TextEncoder().encode(JWT_SECRET);
            const { payload } = await jwtVerify(token, secret);

            if (payload.role !== "admin") {
                return NextResponse.redirect(new URL("/", request.url));
            }
        } catch (e) {
            return NextResponse.redirect(new URL("/login", request.url));
        }
    }

    // Redirect logged-in users away from auth pages
    // Redirect logged-in users away from auth pages
    if (pathname === "/login" || pathname === "/register") {
        if (token) {
            try {
                const secret = new TextEncoder().encode(JWT_SECRET);
                await jwtVerify(token, secret);
                console.log("Proxy: Valid token found on auth page, redirecting to home.");
                return NextResponse.redirect(new URL("/", request.url));
            } catch (e) {
                console.log("Proxy: Token invalid/expired on auth page, allowing access.");
                // Token is invalid - allow access (and maybe response.cookies.delete could go here if we could modify response)
            }
        }
    }

    // Protect Dashboard Routes
    if (pathname.startsWith("/dashboard")) {
        if (!token) {
            return NextResponse.redirect(new URL("/login", request.url));
        }
    }

    const response = NextResponse.next();

    // Additional security headers that can be set via proxy
    response.headers.set("X-XSS-Protection", "1; mode=block");

    return response;
}

export const config = {
    matcher: ["/admin/:path*", "/dashboard/:path*", "/login", "/register"],
};