import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import CertificateRequest from "@/models/CertificateRequest";
import Course from "@/models/Course";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        await dbConnect();

        // Extract token
        const cookieStore = await cookies();
        const token = cookieStore.get("session_token")?.value;

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Verify token
        const payload = verifyToken(token);
        if (!payload) {
            return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
        }
        const userId = payload.userId;

        const body = await req.json();
        const { courseId, fullName, phoneNumber } = body;

        const course = await Course.findById(courseId).select("certificateEnabled").lean();
        if (!course) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        const courseWithCertificate = course as { certificateEnabled?: boolean };
        if (courseWithCertificate.certificateEnabled === false) {
            return NextResponse.json({ error: "Certificate is not available for this course" }, { status: 400 });
        }

        // Check if already requested
        const existing = await CertificateRequest.findOne({ userId, courseId });
        if (existing) {
            return NextResponse.json({ error: "Request already exists" }, { status: 400 });
        }

        const newRequest = await CertificateRequest.create({
            userId,
            courseId,
            fullName,
            phoneNumber
        });

        return NextResponse.json({ request: newRequest }, { status: 201 });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
