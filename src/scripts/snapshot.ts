import mongoose from "mongoose";
import Course from "../models/Course";
import Section from "../models/Section";
import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const seedDataPath = path.resolve(process.cwd(), "src", "scripts", "seed-data.json");

async function snapshot() {
    console.log("📸 Starting database snapshot...");

    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is not defined in environment");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const existingCourse = await Course.findOne({}).sort({ createdAt: 1 }).lean();
    if (!existingCourse) {
        console.log("⚠️ No courses found. Snapshot not created.");
        return;
    }

    const sections = await Section.find({ courseId: existingCourse._id })
        .sort({ order: 1 })
        .lean();

    const snapshotData = {
        course: {
            title: existingCourse.title,
            description: existingCourse.description,
            difficulty: existingCourse.difficulty,
            languages: existingCourse.languages || [],
            price: existingCourse.price || 0,
            discountPrice: existingCourse.discountPrice,
            discountActive: !!existingCourse.discountActive,
            isFree: !!existingCourse.isFree,
            isFeatured: !!existingCourse.isFeatured,
        },
        sections: sections.map((section: any) => ({
            title: section.title,
            content: section.content || "",
            type: section.type || "text",
            videoUrl: section.videoUrl,
            linkUrl: section.linkUrl,
            questions: section.questions || [],
            isFree: !!section.isFree,
            order: section.order,
        })),
    };

    await fs.writeFile(seedDataPath, JSON.stringify(snapshotData, null, 2), "utf8");
    console.log(`💾 Snapshot saved to ${seedDataPath}`);
}

snapshot()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await mongoose.disconnect();
        process.exit(0);
    });
