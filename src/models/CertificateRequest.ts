import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICertificateRequest extends Document {
    userId: mongoose.Types.ObjectId;
    courseId: mongoose.Types.ObjectId;
    fullName: string;
    phoneNumber: string;
    status: "pending" | "approved" | "rejected";
    createdAt: Date;
    updatedAt: Date;
}

const CertificateRequestSchema: Schema<ICertificateRequest> = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
        fullName: { type: String, required: true },
        phoneNumber: { type: String, required: true },
        status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    },
    { timestamps: true }
);

// Prevent overwrite
const CertificateRequest: Model<ICertificateRequest> =
    mongoose.models.CertificateRequest || mongoose.model<ICertificateRequest>("CertificateRequest", CertificateRequestSchema);

export default CertificateRequest;
