import mongoose, { Schema, Document, Model } from "mongoose";
import "./Section"; // Helper to ensure model registration

export interface ICourse extends Document {
    title: string;
    description: string;
    thumbnail: string;
    difficulty: "beginner" | "intermediate" | "advanced";
    languages: string[];
    price: number;
    discountPrice?: number;
    discountActive: boolean;
    certificateEnabled: boolean;
    isFree: boolean;
    isFeatured: boolean;
    sections: mongoose.Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const CourseSchema: Schema<ICourse> = new Schema(
    {
        title: { type: String, required: true },
        description: { type: String, required: true },
        thumbnail: { type: String, required: true },
        difficulty: {
            type: String,
            enum: ["beginner", "intermediate", "advanced"],
            default: "beginner",
        },
        languages: { type: [String], default: [] },
        price: { type: Number, default: 0 },
        discountPrice: { type: Number },
        discountActive: { type: Boolean, default: false },
        certificateEnabled: { type: Boolean, default: true },
        isFree: { type: Boolean, default: false },
        isFeatured: { type: Boolean, default: false },
        sections: [{ type: Schema.Types.ObjectId, ref: "Section" }],
    },
    { timestamps: true }
);

const Course: Model<ICourse> =
    mongoose.models.Course || mongoose.model<ICourse>("Course", CourseSchema);

export default Course;
