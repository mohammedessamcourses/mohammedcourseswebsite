"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GameCard } from "@/components/ui/GameCard";
import { GameButton } from "@/components/ui/GameButton";
import { Search, Filter, Play, Tag } from "lucide-react";
import { CourseSidebar } from "@/components/courses/CourseSidebar";

interface CoursesClientProps {
    courses: any[];
}

export default function CoursesClient({ courses }: CoursesClientProps) {
    const [liveCourses, setLiveCourses] = useState<any[]>(courses || []);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchLatestCourses = async () => {
            try {
                const res = await fetch(`/api/courses?t=${Date.now()}`, { cache: "no-store" });
                if (!res.ok) return;
                const data = await res.json();
                if (isMounted && Array.isArray(data.courses)) {
                    setLiveCourses(data.courses);
                }
            } catch {
                // keep server-provided courses as fallback
            }
        };

        fetchLatestCourses();

        return () => {
            isMounted = false;
        };
    }, []);

    // Get all unique languages
    const allLanguages = Array.from(new Set(liveCourses.flatMap(c => c.languages || [])));

    const filteredCourses = liveCourses.filter(course => {
        const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            course.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLang = selectedLanguage ? course.languages?.includes(selectedLanguage) : true;

        return matchesSearch && matchesLang;
    });

    return (
        <div className="flex flex-col md:flex-row gap-8 relative items-start">

            {/* Mobile Filter Toggle */}
            <div className="md:hidden w-full mb-4">
                <GameButton
                    variant="secondary"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={() => setIsSidebarOpen(true)}
                >
                    <Filter className="w-4 h-4" /> FILTERS & SEARCH
                </GameButton>
            </div>

            {/* Sidebar Component */}
            <CourseSidebar
                allLanguages={allLanguages as string[]}
                selectedLanguage={selectedLanguage}
                setSelectedLanguage={setSelectedLanguage}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            {/* Course Grid */}
            <div className="flex-1 w-full">
                <div className="grid grid-cols-1 min-[938px]:grid-cols-2 min-[1280px]:grid-cols-3 gap-6">
                    {filteredCourses.length > 0 ? (
                        filteredCourses.map((course: any) => (
                            <div key={course._id} className="group relative h-full">
                                <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />

                                <GameCard className="h-full flex flex-col relative z-10 bg-slate-900/90 backdrop-blur">
                                    <Link href={`/courses/${course._id}`} className="block">
                                        <div className="aspect-video bg-slate-800 mb-4 rounded border border-slate-700 overflow-hidden relative">
                                            {course.thumbnail && (
                                                <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
                                            )}
                                            {/* Discount Badge */}
                                            {course.discountActive && !course.isFree && (
                                                <div className="absolute top-2 right-2 bg-arcade text-black font-press-start text-[8px] px-2 py-1 rounded shadow-lg animate-bounce flex items-center gap-1 z-20">
                                                    <Tag className="w-3 h-3" /> SALE
                                                </div>
                                            )}
                                        </div>
                                    </Link>

                                    <div className="flex flex-col flex-grow">
                                        <div className="flex flex-col md:flex-row justify-between items-start mb-2 gap-2 md:gap-0">
                                            <div>
                                                <h3 className="font-heading text-lg text-primary group-hover:text-white transition-colors">
                                                    <Link href={`/courses/${course._id}`}>{course.title}</Link>
                                                </h3>
                                                {/* Difficulty Badge */}
                                                {course.difficulty && (
                                                    <span className={`text-[10px] font-mono px-1.5 rounded uppercase mt-1 inline-block border ${course.difficulty === 'beginner' ? 'bg-green-500/20 text-green-500 border-green-500/30' :
                                                        course.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' :
                                                            'bg-red-500/20 text-red-500 border-red-500/30'
                                                        }`}>
                                                        {course.difficulty}
                                                    </span>
                                                )}
                                            </div>
                                            {course.isFree ? (
                                                <span className="text-sm font-bold bg-primary/20 text-primary px-3 py-1 rounded font-mono whitespace-nowrap self-start md:self-auto uppercase tracking-tighter">FREE ACCESS</span>
                                            ) : (
                                                <div className="flex flex-col items-end">
                                                    {course.discountActive && course.discountPrice !== undefined && course.discountPrice !== null && course.discountPrice < course.price ? (
                                                        <>
                                                            <span className="text-[10px] font-mono text-slate-500 line-through decoration-arcade/50">{course.price} EGP</span>
                                                            <span className="text-sm md:text-base font-bold font-press-start text-arcade whitespace-nowrap animate-pulse">
                                                                {course.discountPrice} EGP
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-sm md:text-base font-bold font-press-start text-arcade whitespace-nowrap self-start md:self-auto">{course.price} EGP</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-slate-400 text-base font-mono mb-4 line-clamp-3 flex-grow">
                                            {course.description}
                                        </p>

                                        {course.languages && course.languages.length > 0 && (
                                            <div className="flex gap-2 mb-4 flex-wrap">
                                                {course.languages.map((lang: string) => (
                                                    <span key={lang} className="text-[10px] flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono">
                                                        <Tag className="w-3 h-3" /> {lang}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="mt-auto">
                                            <Link href={`/courses/${course._id}`}>
                                                <GameButton className="w-full" variant="secondary">
                                                    DETAILS <Play className="w-3 h-3 ml-2" />
                                                </GameButton>
                                            </Link>
                                        </div>
                                    </div>
                                </GameCard>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-20 text-center border border-dashed border-slate-800 rounded bg-slate-900/30">
                            <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-xl font-heading text-slate-500 mb-2">No Courses Found</h3>
                            <p className="text-slate-500 font-mono">Try adjusting your search filters.</p>
                            <button
                                onClick={() => { setSearchQuery(""); setSelectedLanguage(null) }}
                                className="mt-4 text-primary hover:underline font-mono text-sm"
                            >
                                Reset Filters
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
