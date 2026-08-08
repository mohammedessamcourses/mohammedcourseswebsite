import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import CertificateRequest from "@/models/CertificateRequest";
import { logActivity } from "@/lib/activity";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const { status } = await req.json();

        const updatedRequest = await CertificateRequest.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (updatedRequest && (status === "approved" || status === "rejected")) {
            await logActivity({
                type: status === "approved" ? "certificate_approved" : "certificate_rejected",
                description: `Certificate request for ${updatedRequest.fullName || "a user"} was ${status}`,
                userId: updatedRequest.userId,
                userName: updatedRequest.fullName,
                metadata: { requestId: id, courseId: String(updatedRequest.courseId), status },
                req,
            });
        }

        return NextResponse.json({ request: updatedRequest });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await params;
        await CertificateRequest.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
