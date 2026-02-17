import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Course from "@/models/Course";
import Section from "@/models/Section"; // Import to ensure model is registered
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COURSE_PICTURES_BUCKET = "coursespictures";

function extractCoursePicturePath(url?: string | null) {
    if (!url) return null;

    try {
        const parsed = new URL(url);
        const prefix = `/storage/v1/object/public/${COURSE_PICTURES_BUCKET}/`;
        const pathWithPrefix = parsed.pathname;

        if (!pathWithPrefix.startsWith(prefix)) return null;

        const objectPath = pathWithPrefix.slice(prefix.length);
        return objectPath ? decodeURIComponent(objectPath) : null;
    } catch {
        return null;
    }
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const adminView = searchParams.get("adminView") === "1";

        // Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const course = await Course.findById(id).populate("sections").lean();

        if (!course) {
            return NextResponse.json({ error: "Not Found" }, { status: 404 });
        }

        const rawSections = (course as any).sections || [];
        const normalizedSections = rawSections.filter((section: any) => !!section && !!section._id);

        if (normalizedSections.length !== rawSections.length) {
            await Course.findByIdAndUpdate(id, {
                $set: { sections: normalizedSections.map((section: any) => section._id) }
            });
        }

        if (adminView) {
            const cookieStore = await cookies();
            const token = cookieStore.get("session_token")?.value;
            if (!token) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            const payload = verifyToken(token);
            if (!payload || payload.role !== "admin") {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }

            return NextResponse.json({
                course: {
                    ...course,
                    sections: normalizedSections,
                    certificateEnabled: (course as any).certificateEnabled === false ? false : true,
                    isLocked: false,
                },
            });
        }

        // Check User Access
        const cookieStore = await cookies();
        const token = cookieStore.get("session_token")?.value;
        let hasFullAccess = false;
        let isAdmin = false;

        if (course.isFree) {
            hasFullAccess = true;
        } else if (token) {
            const payload = verifyToken(token);
            if (payload) {
                if (payload.role === "admin") {
                    hasFullAccess = true;
                    isAdmin = true;
                } else {
                    // Check if user unlocked this course
                    const user = await User.findById(payload.userId).select("unlockedCourses");
                    if (user && user.unlockedCourses.includes(course._id)) {
                        hasFullAccess = true;
                    }
                }
            }
        }

        // Process sections to hide content if locked
        const sections = normalizedSections.map((section: any) => {
            const isLocked = !hasFullAccess && !section.isFree;

            if (isAdmin) return section; // Admins see everything

            if (isLocked) {
                return {
                    _id: section._id,
                    title: section.title,
                    isFree: section.isFree,
                    order: section.order,
                    isLocked: true,
                    // Omit content, videoUrl, quiz, pdfUrl
                };
            }
            return {
                ...section,
                isLocked: false,
            };
        });

        return NextResponse.json({
            course: {
                ...course,
                sections,
                certificateEnabled: (course as any).certificateEnabled === false ? false : true,
                isLocked: !hasFullAccess && !course.isFree, // Course level lock status for UI
            },
        });
    } catch (error) {
        console.error("Course Detail Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await params;
        const body = await req.json();

        // Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        // Check Admin Access
        const cookieStore = await cookies();
        const token = cookieStore.get("session_token")?.value;

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload || payload.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const existingCourse = await Course.findById(id).select("thumbnail").lean();
        if (!existingCourse) {
            return NextResponse.json({ error: "Not Found" }, { status: 404 });
        }

        const previousThumbnail = typeof (existingCourse as any).thumbnail === "string" ? (existingCourse as any).thumbnail : "";

        const updatePayload = { ...body } as Record<string, any>;
        if ("certificateEnabled" in updatePayload) {
            const rawValue = updatePayload.certificateEnabled;
            if (rawValue === "false" || rawValue === 0 || rawValue === "0") {
                updatePayload.certificateEnabled = false;
            } else if (rawValue === "true" || rawValue === 1 || rawValue === "1") {
                updatePayload.certificateEnabled = true;
            } else {
                updatePayload.certificateEnabled = !!rawValue;
            }
        }

        const nextThumbnail = typeof updatePayload.thumbnail === "string" ? updatePayload.thumbnail : previousThumbnail;
        const shouldDeletePreviousThumbnail =
            typeof updatePayload.thumbnail === "string" &&
            !!previousThumbnail &&
            previousThumbnail !== nextThumbnail;
        const previousThumbnailPath = shouldDeletePreviousThumbnail
            ? extractCoursePicturePath(previousThumbnail)
            : null;

        const updateResult = await Course.updateOne(
            { _id: id },
            { $set: updatePayload },
            { runValidators: true, strict: false }
        );

        if (!updateResult.matchedCount) {
            return NextResponse.json({ error: "Not Found" }, { status: 404 });
        }

        revalidatePath("/courses", "page");
        revalidatePath(`/courses/${id}`, "page");
        revalidatePath("/", "page");
        revalidatePath("/dashboard", "page");
        revalidatePath("/admin", "page");

        if (previousThumbnailPath && supabaseAdmin) {
            const { error: removeError } = await supabaseAdmin.storage
                .from(COURSE_PICTURES_BUCKET)
                .remove([previousThumbnailPath]);

            if (removeError) {
                console.warn("Failed to remove old course thumbnail from Supabase:", removeError.message);
            }
        }

        const persistedCourse = await Course.findById(id).populate("sections").lean();
        if (!persistedCourse) {
            return NextResponse.json({ error: "Course saved but could not be reloaded" }, { status: 500 });
        }

        if ("certificateEnabled" in updatePayload) {
            const expectedCertificateEnabled = updatePayload.certificateEnabled === false ? false : true;
            const actualCertificateEnabled = (persistedCourse as any).certificateEnabled === false ? false : true;

            if (expectedCertificateEnabled !== actualCertificateEnabled) {
                return NextResponse.json(
                    {
                        error: "Save verification failed for certificate setting",
                        expectedCertificateEnabled,
                        actualCertificateEnabled,
                    },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            course: {
                ...persistedCourse,
                certificateEnabled: (persistedCourse as any).certificateEnabled === false ? false : true,
            }
        });
    } catch (error) {
        console.error("Course Update Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const cookieStore = await cookies();
        const token = cookieStore.get("session_token")?.value;

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload || payload.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const courseObjectId = new mongoose.Types.ObjectId(id);

        const sections = await Section.find({ courseId: courseObjectId }).select("_id").lean();
        const sectionIds = sections.map(s => s._id);

        const deletedCourse = await Course.findByIdAndDelete(courseObjectId);
        if (!deletedCourse) {
            return NextResponse.json({ error: "Not Found" }, { status: 404 });
        }

        await Section.deleteMany({ courseId: courseObjectId });

        await User.updateMany(
            {},
            {
                $pull: {
                    unlockedCourses: courseObjectId,
                    completedCourses: courseObjectId,
                    ...(sectionIds.length ? { completedSections: { $in: sectionIds } } : {})
                }
            }
        );

        revalidatePath("/courses", "page");
        revalidatePath("/dashboard", "page");
        revalidatePath("/admin", "page");

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Course Delete Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
