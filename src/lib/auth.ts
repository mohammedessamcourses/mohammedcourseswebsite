import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "jwt_4o3uJ5Kf7Xn2Qv9Pz1Lm6Rs8Tt0Yw3Bh";

export interface TokenPayload {
    userId: string;
    role: "student" | "admin";
}

export function signToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as TokenPayload;
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
