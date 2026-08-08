/**
 * Static course images.
 *
 * Images are plain files in `public/` and are referenced from here — there is no
 * upload flow and nothing image-related is stored in the database.
 *
 * To give a course its own picture:
 *   1. Drop the file into `public/` (e.g. `public/react-course.png`)
 *   2. Add a line to COURSE_IMAGES mapping that course's _id to `/react-course.png`
 *
 * Any course not listed below falls back to DEFAULT_COURSE_IMAGE.
 */
export const DEFAULT_COURSE_IMAGE = "/FREEcourse.png";

export const COURSE_IMAGES: Record<string, string> = {
    // "68f1c2ab34de5f0012345678": "/react-course.png",
};

export function getCourseImage(courseId?: string | null): string {
    if (!courseId) return DEFAULT_COURSE_IMAGE;
    return COURSE_IMAGES[String(courseId)] || DEFAULT_COURSE_IMAGE;
}
