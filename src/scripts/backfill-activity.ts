/**
 * Seeds the activity log from records that already carry real timestamps, so the
 * dashboard has history from day one instead of starting empty.
 *
 *   npm run backfill:activity
 *
 * Only genuine recorded events are reproduced — registrations, access requests,
 * certificate requests and contact messages. Logins, quiz answers and section
 * completions are NOT invented, because nothing in the existing data records when
 * they happened; those metrics start accumulating from the moment logging is live.
 *
 * Idempotent: every row it writes is tagged `metadata.backfilled = true`, and the
 * script clears those tags before re-inserting, so re-running never duplicates.
 *
 * SAFE BY DEFAULT: this is a dry run unless you pass `--commit`. It only ever
 * writes to the `activitylogs` collection; every other collection is read-only.
 *
 *   npm run backfill:activity            # preview, writes nothing
 *   npm run backfill:activity -- --commit  # actually write
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import mongoose from "mongoose";
import ActivityLog from "../models/ActivityLog";
import User from "../models/User";
import Course from "../models/Course";
import AccessRequest from "../models/AccessRequest";
import CertificateRequest from "../models/CertificateRequest";
import ContactMessage from "../models/ContactMessage";

interface SeedRow {
    type: string;
    description: string;
    userId?: mongoose.Types.ObjectId | null;
    userName?: string;
    userEmail?: string;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

const COMMIT = process.argv.includes("--commit");

async function backfill() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");

    await mongoose.connect(uri);

    // Surface which database is about to be touched before anything is written.
    const dbName = mongoose.connection.name;
    const host = mongoose.connection.host;
    console.log(`Connected to "${dbName}" @ ${host}`);
    console.log(COMMIT ? "MODE: COMMIT (will write)" : "MODE: DRY RUN (no writes — pass --commit to apply)");

    const [users, courses, accessRequests, certRequests, messages] = await Promise.all([
        User.find({}).select("name email role createdAt").lean(),
        Course.find({}).select("title").lean(),
        AccessRequest.find({}).lean(),
        CertificateRequest.find({}).lean(),
        ContactMessage.find({}).lean(),
    ]);

    const userById = new Map(users.map((u) => [String(u._id), u]));
    const courseTitleById = new Map(courses.map((c) => [String(c._id), c.title]));

    const rows: SeedRow[] = [];
    const stamp = (date: unknown): Date => (date ? new Date(date as string) : new Date());

    for (const u of users) {
        rows.push({
            type: "register",
            description: `${u.name} registered`,
            userId: u._id as mongoose.Types.ObjectId,
            userName: u.name,
            userEmail: u.email,
            metadata: { backfilled: true, role: u.role },
            createdAt: stamp(u.createdAt),
            updatedAt: stamp(u.createdAt),
        });
    }

    for (const r of accessRequests) {
        const u = userById.get(String(r.userId));
        const courseTitle = courseTitleById.get(String(r.courseId)) || "a course";
        const who = r.paymentDetails?.fullName || u?.name || "A user";

        rows.push({
            type: "access_requested",
            description: `${who} requested access to ${courseTitle}`,
            userId: r.userId as mongoose.Types.ObjectId,
            userName: u?.name || who,
            userEmail: u?.email,
            metadata: {
                backfilled: true,
                courseId: String(r.courseId),
                courseTitle,
                amount: r.paymentDetails?.amount ?? 0,
            },
            createdAt: stamp(r.createdAt),
            updatedAt: stamp(r.createdAt),
        });

        // A decided request also implies a moderation event, timestamped at its update.
        if (r.status === "approved" || r.status === "rejected") {
            rows.push({
                type: r.status === "approved" ? "access_approved" : "access_rejected",
                description: `Admin ${r.status} ${who}'s access request for ${courseTitle}`,
                userId: r.userId as mongoose.Types.ObjectId,
                userName: u?.name || who,
                userEmail: u?.email,
                metadata: { backfilled: true, courseId: String(r.courseId), courseTitle, status: r.status },
                createdAt: stamp(r.updatedAt || r.createdAt),
                updatedAt: stamp(r.updatedAt || r.createdAt),
            });
        }
    }

    for (const c of certRequests) {
        const u = userById.get(String(c.userId));
        const courseTitle = courseTitleById.get(String(c.courseId)) || "a course";

        rows.push({
            type: "certificate_requested",
            description: `${c.fullName || u?.name || "A user"} requested a certificate for ${courseTitle}`,
            userId: c.userId as mongoose.Types.ObjectId,
            userName: u?.name || c.fullName,
            userEmail: u?.email,
            metadata: { backfilled: true, courseId: String(c.courseId), courseTitle, status: c.status },
            createdAt: stamp(c.createdAt),
            updatedAt: stamp(c.createdAt),
        });

        if (c.status === "approved" || c.status === "rejected") {
            rows.push({
                type: c.status === "approved" ? "certificate_approved" : "certificate_rejected",
                description: `Certificate request for ${c.fullName || u?.name || "a user"} was ${c.status}`,
                userId: c.userId as mongoose.Types.ObjectId,
                userName: u?.name || c.fullName,
                userEmail: u?.email,
                metadata: { backfilled: true, courseId: String(c.courseId), courseTitle, status: c.status },
                createdAt: stamp(c.updatedAt || c.createdAt),
                updatedAt: stamp(c.updatedAt || c.createdAt),
            });
        }
    }

    for (const m of messages) {
        rows.push({
            type: "contact_message",
            description: `${m.name} sent a contact message from "${m.source}"`,
            userName: m.name,
            metadata: { backfilled: true, source: m.source, phone: m.phone },
            createdAt: stamp(m.createdAt),
            updatedAt: stamp(m.createdAt),
        });
    }

    if (!rows.length) {
        console.log("Nothing to backfill.");
        await mongoose.disconnect();
        return;
    }

    const counts = rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
    }, {});

    console.log(`\n${COMMIT ? "Backfilling" : "Would backfill"} ${rows.length} activity entries:`);
    for (const [type, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${type.padEnd(24)} ${count}`);
    }

    if (!COMMIT) {
        const existing = await ActivityLog.countDocuments({ "metadata.backfilled": true });
        console.log(`\nDry run — nothing written. ${existing} backfilled row(s) currently in activitylogs.`);
        console.log("Re-run with --commit to apply.");
        await mongoose.disconnect();
        return;
    }

    const removed = await ActivityLog.deleteMany({ "metadata.backfilled": true });
    if (removed.deletedCount) {
        console.log(`\nCleared ${removed.deletedCount} previously backfilled entries`);
    }

    // timestamps:true would overwrite createdAt on insert, erasing the real dates.
    await ActivityLog.insertMany(rows, { ordered: false, timestamps: false });

    await mongoose.disconnect();
    console.log("\nDone.");
}

backfill().catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
});
