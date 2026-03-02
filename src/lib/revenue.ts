export interface RevenueCourseLike {
    price?: number;
    discountActive?: boolean;
    discountPrice?: number | null;
}

export interface RevenueRequestLike {
    status?: string;
    paymentDetails?: {
        amount?: number | null;
    };
    courseId?: RevenueCourseLike | string | null;
}

export const getApprovedPaidAmount = (
    req: RevenueRequestLike,
    courseFallback?: RevenueCourseLike | null
): number => {
    if (!req || req.status !== "approved") return 0;

    const course =
        (req.courseId && typeof req.courseId === "object" ? req.courseId : null) ??
        courseFallback ??
        null;

    if (!course) return 0;

    if (course.discountActive && typeof course.discountPrice === "number" && course.discountPrice > 0) {
        return course.discountPrice;
    }

    const amount = req.paymentDetails?.amount ?? course.price ?? 0;
    return amount > 0 ? amount : 0;
};

