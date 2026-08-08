import mongoose from "mongoose";
import User from "../models/User";
import Course from "../models/Course";
import Section from "../models/Section";
import AccessRequest from "../models/AccessRequest";
import dbConnect from "../lib/db";
import { hashPassword } from "../lib/auth";
import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const seedDataPath = path.resolve(process.cwd(), "src", "scripts", "seed-data.json");

const loadSeedSnapshot = async () => {
    try {
        const raw = await fs.readFile(seedDataPath, "utf8");
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const saveSeedSnapshot = async () => {
    const existingCourse = await Course.findOne({}).sort({ createdAt: 1 }).lean();
    if (!existingCourse) return;

    const sections = await Section.find({ courseId: existingCourse._id })
        .sort({ order: 1 })
        .lean();

    const snapshot = {
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

    await fs.writeFile(seedDataPath, JSON.stringify(snapshot, null, 2), "utf8");
    console.log(`💾 Saved course snapshot to ${seedDataPath}`);
};

// Helper to run seed
async function seed() {
    console.log("🌱 Starting Database Seed...");

    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is not defined in environment");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    await saveSeedSnapshot();

    // Clear Database (KEEP COURSES AND SECTIONS)
    await User.deleteMany({});
    // await Course.deleteMany({});
    // await Section.deleteMany({});
    await AccessRequest.deleteMany({});
    console.log("🧹 Cleared users and requests (kept courses/sections)");

    // Create Users
    const studentPassword = await hashPassword("password123");
    const adminPassword = await hashPassword("admin123");

    const admin = await User.create({
        name: "System Administrator",
        email: "admin@example.com",
        phone: "01000000000",
        password: adminPassword,
        role: "admin",
        xp: 9999,
        level: 100,
    });

    const student = await User.create({
        name: "Ready Player One",
        email: "student@example.com",
        phone: "01111111111",
        password: studentPassword,
        role: "student",
        xp: 50,
        level: 1,
    });

    console.log("👥 Users Created: Admin & Student");

    const existingCoursesCount = await Course.countDocuments();
    if (existingCoursesCount === 0) {
        const snapshot = await loadSeedSnapshot();
        if (snapshot?.course) {
            console.log("📚 No courses found, creating from seed snapshot...");
            const course = await Course.create(snapshot.course);

            const sectionIds: any[] = [];
            for (const section of snapshot.sections || []) {
                const createdSection = await Section.create({
                    ...section,
                    courseId: course._id,
                });
                sectionIds.push(createdSection._id);
            }

            course.sections.push(...sectionIds);
            await course.save();

            console.log("📚 Course created from seed snapshot");
        } else {
            console.log("📚 No courses found, creating default courses...");
            // Create Courses
            const freeCourse = await Course.create({
                title: "Intro to Cyberpunk Coding",
                description: "Learn the basics of the grid. Survive the net. Free entry for all neon runners.",
                difficulty: "beginner",
                price: 0,
                isFree: true,
                languages: ["HTML", "CSS"],
            });

            const paidCourse = await Course.create({
                title: "Mastering the Matrix",
                description: "Advanced techniques for high-level operatives. Payment required. Clearance restricted.",
                difficulty: "advanced",
                price: 500,
                discountPrice: 250,
                discountActive: true,
                isFree: false,
                isFeatured: true,
                languages: ["React", "TypeScript", "Node.js"],
            });

            console.log("📚 Default Courses Created");

            // Create Sections for Free Course
            const s1 = await Section.create({
                courseId: freeCourse._id,
                title: "The Awakening",
                content: "Welcome to the digital frontier. In this section, we will explore the basics of HTML5 and Semantics.\n\n### Your First Element\n\n```html\n<h1>Hello Night City</h1>\n```\n\nUnderstand this, and you understand the layout of the web.",
                isFree: true,
                order: 1,
            });

            const s2 = await Section.create({
                courseId: freeCourse._id,
                title: "Styling the Void",
                content: "CSS is the paint for your canvas. Learn to manipulate colors, layout, and responsiveness.\n\nUse the `flex` property to align your thoughts.",
                isFree: true,
                order: 2,
            });

            // Link sections to course
            freeCourse.sections.push(s1._id, s2._id);
            await freeCourse.save();

            // Create Sections for Paid Course
            const s3 = await Section.create({
                courseId: paidCourse._id,
                title: "Red Pill or Blue Pill?",
                content: "This content is locked behind a paywall. If you are reading this, you have clearance.\n\nReact Hooks are the red pill.",
                isFree: false, // Locked even if course is free (though this course is paid)
                order: 1,
            });

            paidCourse.sections.push(s3._id);
            await paidCourse.save();

            console.log("📄 Default Sections Created");
        }
    } else {
        console.log(`📚 Found ${existingCoursesCount} existing courses. Skipping course creation.`);
    }

    // Create Example Access Request
    let courseForRequest = await Course.findOne({ isFree: false });
    if (!courseForRequest) courseForRequest = await Course.findOne({});

    if (courseForRequest) {
        await AccessRequest.create({
            userId: student._id,
            courseId: courseForRequest._id,
            status: "pending",
            paymentDetails: {
                fullName: "Wade Watts",
                phoneNumber: "01010101010",
                transactionNotes: "Sent via Instapay",
                amount: (courseForRequest as any).discountActive ? (courseForRequest as any).discountPrice : (courseForRequest as any).price || 0
            },
        });
        console.log(`✉️ Access Request Created for course: ${courseForRequest.title}`);
    } else {
        console.log("⚠️ No courses found to create an access request for.");
    }

    console.log("🌱 Seed Complete!");

    process.exit(0);
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
