export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = "force-no-store";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { CourseView } from "@/components/game/CourseView";
import dbConnect from "@/lib/db";
import Course from "@/models/Course";
import User from "@/models/User";
import CertificateRequest from "@/models/CertificateRequest";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import mongoose from "mongoose";
import "@/models/Section"; // Force Section model registration

import AccessRequest from "@/models/AccessRequest";

async function getCourseData(id: string) {
    noStore();
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    await dbConnect();
    const course = await Course.findById(id).populate("sections").lean();
    if (!course) return null;

    let user = null;
    let hasFullAccess = false;
    let isAdmin = false;
    let hasPendingCertificate = false;
    let hasPendingAccessRequest = false;

    if (token) {
        const payload = verifyToken(token);
        if (payload) {
            user = await User.findById(payload.userId).lean();
            if (user) {
                if (payload.role === "admin") {
                    hasFullAccess = true;
                    isAdmin = true;
                } else {
                    const userObj = user as any;
                    if (userObj.unlockedCourses.map((id: any) => id.toString()).includes(course._id.toString())) {
                        hasFullAccess = true;
                    }
                }

                // Check pending certificate
                const existingCertRequest = await CertificateRequest.findOne({
                    userId: payload.userId,
                    courseId: id
                });
                hasPendingCertificate = !!existingCertRequest;

                // Check pending access request
                const existingAccessRequest = await AccessRequest.findOne({
                    userId: payload.userId,
                    courseId: id,
                    status: "pending"
                });
                hasPendingAccessRequest = !!existingAccessRequest;
            }
        }
    }

    // Filter sections and ensure IDs are strings
    const sections = (course.sections as any[]).map((section: any) => {
        const isLocked = !hasFullAccess && !course.isFree && !section.isFree;
        const sId = section._id.toString();

        if (isAdmin) return {
            ...section,
            _id: sId,
            isLocked: false
        };

        if (isLocked) {
            return {
                _id: sId,
                title: section.title,
                isFree: section.isFree,
                order: section.order,
                isLocked: true,
            };
        }
        return {
            _id: sId,
            title: section.title,
            isFree: section.isFree,
            order: section.order,
            type: section.type,
            content: section.content,
            videoUrl: section.videoUrl,
            linkUrl: section.linkUrl,
            questions: section.questions,
            isLocked: false,
        };
    });

    const finalUser = user ? {
        ...user,
        _id: (user as any)._id.toString(),
        completedSections: (user as any).completedSections.map((id: any) => id.toString()),
        answeredQuestions: (user as any).answeredQuestions?.map((id: any) => String(id)) || []
    } : null;

    // Final synchronization log
    if (finalUser) {
        console.log(`[QUIZ-SYNC] User: ${finalUser.email}, Saved Answers: ${finalUser.answeredQuestions.length}`);
    }

    return JSON.parse(JSON.stringify({
        course: {
            ...course,
            _id: course._id.toString(),
            sections,
            isLocked: !hasFullAccess && !course.isFree
        },
        user: finalUser,
        hasPendingCertificate,
        hasPendingAccessRequest
    }));
}

export default async function CoursePage(
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const data = await getCourseData(id);

    if (!data) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                Course Not Found
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 text-white flex flex-col">
            <Navbar />
            <div className="flex-1">
                <CourseView
                    course={data.course}
                    user={data.user}
                    hasPendingCertificate={data.hasPendingCertificate}
                    hasPendingAccessRequest={data.hasPendingAccessRequest}
                />
            </div>
            <Footer />
        </main>
    );
}
