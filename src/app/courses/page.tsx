export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import dbConnect from "@/lib/db";
import Course from "@/models/Course";
import CoursesClient from "./CoursesClient";
import { ContactSection } from "@/components/ui/ContactSection";
import { unstable_noStore as noStore } from "next/cache";

async function getCourses() {
    noStore();
    await dbConnect();
    const courses = await Course.find({}).populate("sections").sort({ createdAt: -1 }).lean();
    return JSON.parse(JSON.stringify(courses));
}

export default async function CoursesPage() {
    const courses = await getCourses();

    return (
        <main className="min-h-screen bg-slate-950 text-white pb-20">
            <Navbar />

            <div className="max-w-7xl mx-auto px-6 py-10">
                <header className="mb-12 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-heading mb-4 text-shadow text-center md:text-left">ALL COURSES</h1>
                        <p className="font-mono text-slate-400 text-center md:text-left">Explore our library of knowledge. Hack the planet.</p>
                    </div>
                    <img src="/gifs/sitting2.gif" alt="Sitting" className="w-80 md:w-[600px] lg:w-[700px] h-auto object-contain" />
                </header>

                <CoursesClient courses={courses} />
            </div>

            <ContactSection
                source="courses"
                title="CONTACT ME"
                subtitle="Have questions about courses or enrollment? Send a message."
            />

            <Footer />
        </main>
    );
}
