import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
    name: string;
    email: string;
    phone?: string;
    password?: string;
    role: "student" | "admin";

    // Gamification
    xp: number;
    level: number;
    streak: {
        count: number;
        lastActiveDate: Date;
    };

    // Progress & Access
    completedSections: mongoose.Types.ObjectId[];
    completedCourses: mongoose.Types.ObjectId[];
    unlockedCourses: mongoose.Types.ObjectId[]; // For Paid Courses access
    answeredQuestions: string[]; // Format: "sectionId-questionIndex"

    createdAt: Date;
    updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        phone: { type: String },
        password: { type: String, select: false }, // OAuth users might not have password
        role: { type: String, enum: ["student", "admin"], default: "student" },

        xp: { type: Number, default: 0 },
        level: { type: Number, default: 1 },
        streak: {
            count: { type: Number, default: 0 },
            lastActiveDate: { type: Date, default: Date.now },
        },

        completedSections: [{ type: Schema.Types.ObjectId, ref: "Section" }],
        completedCourses: [{ type: Schema.Types.ObjectId, ref: "Course" }],
        unlockedCourses: [{ type: Schema.Types.ObjectId, ref: "Course" }],
        answeredQuestions: { type: [String], default: [] },
    },
    { timestamps: true }
);

UserSchema.index({ createdAt: -1 });
UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ unlockedCourses: 1 });

// Prevent recompilation in development
const User: Model<IUser> =
    mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
