export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { GameCard } from "@/components/ui/GameCard";
import { GameButton } from "@/components/ui/GameButton";
import { LevelPath } from "@/components/game/LevelPath";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import Link from "next/link";
import dbConnect from "@/lib/db";
import Course from "@/models/Course";
import User from "@/models/User";
import CertificateRequest from "@/models/CertificateRequest";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { Play, Zap, Trophy, BookOpen, Target, ArrowRight, Flame, Tag } from "lucide-react";
import { unstable_noStore as noStore } from "next/cache";

async function getData() {
    noStore();
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return { courses: [], user: null, certificateRequests: [] };
    const payload = verifyToken(token);
    if (!payload) return { courses: [], user: null, certificateRequests: [] };

    await dbConnect();
    const user = await User.findById(payload.userId).lean();

    if (user) {
        // We need the Mongoose document for the method, so we might need to re-fetch or cast if using lean()
        // Ideally, separate the updateStreak logic, but for now we'll do a quick specific fetch for streak update if needed
        // or just accept the tiny overhead of one non-lean fetch for the user if we want to call methods.
        // Optimization: Let's keep the user fetch lean for display speed, and do a separate fire-and-forget for streak if strict types allow.
        // Actually, to call `updateStreak(user)`, user needs to be a document.
        // Let's stick to finding the user as a Document for now to keep existing logic working, but optimize the course fetch heavily.
        const userDoc = await User.findById(payload.userId);
        if (userDoc) {
            const { updateStreak } = await import("@/lib/gamification");
            await updateStreak(userDoc);
        }
    }

    if (!user) return { courses: [], user: null, certificateRequests: [] };

    // Optimize: Filter at DB level
    let query = {};
    if (payload.role !== "admin") {
        query = {
            $or: [
                { isFree: true },
                { _id: { $in: (user as any).unlockedCourses || [] } }
            ]
        };
    }

    // Optimize: Only populate _id for sections to calculate progress, avoiding heavy content
    const courses = await Course.find(query)
        .populate("sections", "_id")
        .sort({ order: 1, createdAt: 1 })
        .lean();

    // Fetch certificate requests for this user
    const certificateRequests = await CertificateRequest.find({ userId: payload.userId }).lean();

    return {
        courses: JSON.parse(JSON.stringify(courses)),
        user: JSON.parse(JSON.stringify(user)),
        certificateRequests: JSON.parse(JSON.stringify(certificateRequests))
    };
}

export default async function DashboardPage() {
    const { courses, user, certificateRequests } = await getData();

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
                <Link href="/login"><GameButton>Please Login</GameButton></Link>
            </div>
        )
    }

    // Courses are already filtered by the DB query now
    const enrolledCourses = courses;

    // Calculate stats
    const completedCoursesCount = user.completedCourses?.length || 0;

    // Courses with progress (started but not completed)
    const coursesInProgress = enrolledCourses.filter((c: any) => {
        const sectionIds = c.sections?.map((s: any) => s._id) || [];
        const hasStarted = sectionIds.some((sId: string) => user.completedSections?.includes(sId));
        const isCompleted = user.completedCourses?.includes(c._id);
        return hasStarted && !isCompleted;
    });

    // Calculate course progress
    const getCourseProgress = (course: any) => {
        if (!course.sections?.length) return 0;
        const sectionIds = course.sections.map((s: any) => s._id);
        const completedInCourse = sectionIds.filter((sId: string) => user.completedSections?.includes(sId)).length;
        return Math.round((completedInCourse / sectionIds.length) * 100);
    };

    // Calculate streak
    const streakCount = user.streak?.count || 0;

    return (
        <main className="min-h-screen bg-slate-950 text-white flex flex-col">
            <Navbar />

            <div className="max-w-7xl mx-auto px-6 py-10 flex-1">
                {/* Stats Section */}
                <section className="mb-12">
                    <h2 className="text-xl font-heading text-slate-400 mb-6">YOUR PROFILE</h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <GameCard className="text-center p-6">
                            <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                            <div className="text-3xl font-heading text-primary">{user.xp || 0}</div>
                            <div className="text-xs font-mono text-slate-500">TOTAL XP</div>
                        </GameCard>
                        <GameCard className="text-center p-6">
                            <Trophy className="w-8 h-8 text-primary mx-auto mb-2" />
                            <div className="text-3xl font-heading text-white">{user.level || 1}</div>
                            <div className="text-xs font-mono text-slate-500">LEVEL</div>
                        </GameCard>
                        <GameCard className="text-center p-6">
                            <Flame className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                            <div className="text-3xl font-heading text-orange-400">{streakCount}</div>
                            <div className="text-xs font-mono text-slate-500">DAY STREAK</div>
                        </GameCard>
                        <GameCard className="text-center p-6">
                            <BookOpen className="w-8 h-8 text-secondary mx-auto mb-2" />
                            <div className="text-3xl font-heading text-white">{completedCoursesCount}</div>
                            <div className="text-xs font-mono text-slate-500">COMPLETED</div>
                        </GameCard>
                        <GameCard className="text-center p-6">
                            <Target className="w-8 h-8 text-arcade mx-auto mb-2" />
                            <div className="text-3xl font-heading text-white">{enrolledCourses.length}</div>
                            <div className="text-xs font-mono text-slate-500">ENROLLED</div>
                        </GameCard>
                    </div>

                    {/* Level Path */}
                    <div className="mt-8">
                        <LevelPath xp={user.xp || 0} />
                    </div>
                </section>

                {/* Continue Learning Section */}
                {coursesInProgress.length > 0 && (
                    <section className="mb-12">
                        <h2 className="text-xl font-heading text-slate-400 mb-6">CONTINUE LEARNING</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {coursesInProgress.map((course: any) => {
                                const progress = getCourseProgress(course);
                                return (
                                    <Link key={course._id} href={`/courses/${course._id}`}>
                                        <GameCard className="p-4 hover:border-primary/50 transition-colors cursor-pointer flex flex-wrap sm:flex-nowrap items-center gap-4">
                                            <div className="w-16 h-16 bg-slate-800 rounded overflow-hidden shrink-0">
                                                {course.thumbnail && <img src={course.thumbnail} alt="" className="w-full h-full object-cover" />}
                                            </div>
                                            <div className="flex-grow">
                                                <h4 className="font-heading text-white">{course.title}</h4>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <div className="flex-grow h-2 bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                                                    </div>
                                                    <span className="text-xs font-mono text-primary">{progress}%</span>
                                                </div>
                                            </div>
                                            <ArrowRight className="w-5 h-5 text-slate-500" />
                                        </GameCard>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* My Courses Header */}
                <header className="mb-8 flex flex-col md:flex-row md:items-end gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-4">
                            <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading mb-2 text-shadow font-press-start">My Courses</h1>
                            <img src="/gifs/battle.gif" alt="Battle" className="w-50 h-50 md:w-64 md:h-64 rounded object-contain" />
                        </div>
                        <p className="font-mono text-slate-400">Courses you have access to. <Link href="/courses" className="text-primary hover:underline">Browse all courses →</Link></p>
                    </div>
                </header>

                {/* Enrolled Courses Only */}
                {enrolledCourses.length === 0 ? (
                    <div className="text-center py-16 border border-slate-800 rounded bg-slate-900/50">
                        <BookOpen className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                        <h3 className="text-xl font-heading text-slate-500 mb-2">No Courses Yet</h3>
                        <p className="text-slate-600 font-mono mb-6">You haven't enrolled in any courses yet.</p>
                        <Link href="/courses">
                            <GameButton>BROWSE COURSES</GameButton>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {enrolledCourses.map((course: any) => {
                            const progress = getCourseProgress(course);
                            const isCompleted = user.completedCourses?.includes(course._id);

                            return (
                                <div key={course._id} className="relative group">
                                    <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <GameCard className="h-full flex flex-col relative z-10 bg-slate-900/90 backdrop-blur">
                                        <div className="aspect-video bg-slate-800 mb-4 rounded border border-slate-700 overflow-hidden relative">
                                            {course.thumbnail && (
                                                <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                                            )}

                                            {isCompleted && (
                                                <div className="absolute top-2 left-2 bg-primary text-black text-[10px] font-mono px-2 py-1 rounded z-20">
                                                    ✓ COMPLETED
                                                </div>
                                            )}

                                            {/* Discount Badge */}
                                            {course.discountActive && !course.isFree && (
                                                <div className="absolute top-2 right-2 bg-arcade text-black font-press-start text-[8px] px-2 py-1 rounded shadow-lg animate-bounce flex items-center gap-1 z-20">
                                                    <Tag className="w-3 h-3" /> SALE
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col md:flex-row justify-between items-start mb-2 gap-2 md:gap-0">
                                            <div>
                                                <h3 className="font-heading text-lg text-primary">{course.title}</h3>
                                                {course.difficulty && (
                                                    <span className={`text-[10px] font-mono px-1.5 rounded uppercase mt-1 inline-block border ${course.difficulty === 'beginner' ? 'bg-green-500/20 text-green-500 border-green-500/30' :
                                                        course.difficulty === 'intermediate' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' :
                                                            'bg-red-500/20 text-red-500 border-red-500/30'
                                                        }`}>
                                                        {course.difficulty}
                                                    </span>
                                                )}
                                            </div>
                                            {course.isFree ? (
                                                <span className="text-sm font-bold bg-primary/20 text-primary px-3 py-1 rounded font-mono self-start md:self-auto uppercase tracking-tighter">FREE PLAY</span>
                                            ) : (
                                                <div className="flex flex-col items-end">
                                                    {course.discountActive && course.discountPrice ? (
                                                        <>
                                                            <span className="text-[10px] font-mono text-slate-500 line-through">
                                                                {course.price} EGP
                                                            </span>
                                                            <span className="text-lg md:text-xl font-bold font-press-start text-arcade self-start md:self-auto animate-pulse">
                                                                {course.discountPrice} EGP
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-lg md:text-xl font-bold font-press-start text-arcade self-start md:self-auto">{course.price} EGP</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-slate-400 text-sm font-mono flex-grow mb-4 line-clamp-2">
                                            {course.description}
                                        </p>

                                        {/* Progress Bar */}
                                        <div className="mb-4">
                                            <div className="flex justify-between text-xs font-mono text-slate-500 mb-1">
                                                <span>PROGRESS</span>
                                                <span>{progress}%</span>
                                            </div>
                                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                                            </div>
                                        </div>

                                        <div className="mt-auto">
                                            <Link href={`/courses/${course._id}`}>
                                                <GameButton className="w-full" variant="primary">
                                                    <span className="flex items-center justify-center gap-2">
                                                        <Play className="w-4 h-4" />
                                                        {isCompleted ? "REVIEW COURSE" : progress > 0 ? "CONTINUE COURSE" : "START COURSE"}
                                                    </span>
                                                </GameButton>
                                            </Link>
                                        </div>
                                    </GameCard>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <Footer />
        </main>
    );
}
