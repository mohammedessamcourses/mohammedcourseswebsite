import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAccessRequest extends Document {
    userId: mongoose.Types.ObjectId;
    courseId: mongoose.Types.ObjectId;
    status: "pending" | "approved" | "rejected";
    paymentDetails: {
        fullName: string;
        phoneNumber: string; // WhatsApp
        transactionNotes?: string;
        amount: number;
    };
    adminNotes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const AccessRequestSchema: Schema<IAccessRequest> = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
        paymentDetails: {
            fullName: { type: String, required: true },
            phoneNumber: { type: String, required: true },
            transactionNotes: { type: String },
            amount: { type: Number, required: true },
        },
        adminNotes: { type: String },
    },
    { timestamps: true }
);

AccessRequestSchema.index({ userId: 1, status: 1, createdAt: -1 });
AccessRequestSchema.index({ courseId: 1, status: 1, createdAt: -1 });
AccessRequestSchema.index({ status: 1, createdAt: -1 });

const AccessRequest: Model<IAccessRequest> =
    mongoose.models.AccessRequest ||
    mongoose.model<IAccessRequest>("AccessRequest", AccessRequestSchema);

export default AccessRequest;
