import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

/**
 * Reads the signing secret at call time.
 *
 * There is deliberately no literal fallback: a hardcoded default ends up in the
 * repo, and anyone holding it can forge an admin session.
 *
 * Resolved lazily rather than at module load because scripts call
 * `dotenv.config()` in their body, which runs *after* ES imports are evaluated —
 * a module-level check would throw before the env file was ever read.
 */
function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error(
            "JWT_SECRET is not set. Define it in your environment (.env.local locally, " +
            "and in your hosting provider's environment variables in production)."
        );
    }

    return secret;
}

export interface TokenPayload {
    userId: string;
    role: "student" | "admin";
}

export function signToken(payload: TokenPayload): string {
    return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
    // Resolved outside the try so a misconfigured server surfaces as an error
    // rather than being flattened into "invalid token" for every request.
    const secret = getJwtSecret();

    try {
        return jwt.verify(token, secret) as TokenPayload;
    } catch {
        return null;
    }
}

export async function hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
}

export async function comparePassword(reqPassword: string, dbPassword: string): Promise<boolean> {
    return await bcrypt.compare(reqPassword, dbPassword);
}
