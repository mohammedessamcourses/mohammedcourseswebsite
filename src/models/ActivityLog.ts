import mongoose, { Schema, Document, Model } from "mongoose";

export interface IActivityLog extends Document {
    type: string;
    /** Human-readable summary rendered directly in the admin feed. */
    description: string;
    userId?: mongoose.Types.ObjectId | null;
    /**
     * Snapshot of the actor at event time. Denormalised on purpose: the feed stays
     * readable after a user is deleted, and rendering needs no populate/N+1.
     */
    userName?: string;
    userEmail?: string;
    /** Free-form context: courseId, sectionId, xp awarded, etc. */
    metadata?: Record<string, unknown>;
    ip?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ActivityLogSchema: Schema<IActivityLog> = new Schema(
    {
        type: { type: String, required: true, index: true },
        description: { type: String, required: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
        userName: { type: String },
        userEmail: { type: String },
        metadata: { type: Schema.Types.Mixed, default: {} },
        ip: { type: String },
    },
    { timestamps: true }
);

// Feed is always ordered newest-first; filters narrow by type or by user.
ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ type: 1, createdAt: -1 });
ActivityLogSchema.index({ userId: 1, createdAt: -1 });

const ActivityLog: Model<IActivityLog> =
    mongoose.models.ActivityLog ||
    mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);

export default ActivityLog;
