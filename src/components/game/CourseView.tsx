"use client";

import { useState, useRef, useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GameCard } from "@/components/ui/GameCard";
import { GameInput } from "@/components/ui/GameInput";
import { Lock, Play, CheckCircle, Smartphone, Award, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { XPBar } from "@/components/game/XPBar";
import { QuizView } from "@/components/game/QuizView";

interface CourseViewProps {
    course: any;
    user: any;
    hasPendingCertificate?: boolean;
    hasPendingAccessRequest?: boolean;
}

declare global {
    interface Window {
        YT?: any;
        onYouTubeIframeAPIReady?: () => void;
    }
}

export function CourseView({ course, user, hasPendingCertificate = false, hasPendingAccessRequest = false }: CourseViewProps) {
    const router = useRouter();
    const [currentSection, setCurrentSection] = useState(course.sections[0]);
    const [completedSections, setCompletedSections] = useState<string[]>(user?.completedSections || []);
    const [answeredQuestions, setAnsweredQuestions] = useState<string[]>(user?.answeredQuestions || []);
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [xpGained, setXpGained] = useState<{ amount: number; reason: string } | null>(null);
    const [isPendingAccess, setIsPendingAccess] = useState(hasPendingAccessRequest);
    const [showVideoModal, setShowVideoModal] = useState(false);
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
    const [activeVideoSectionId, setActiveVideoSectionId] = useState<string | null>(null);
    const [videoResumeTimes, setVideoResumeTimes] = useState<Record<string, number>>({});
    const videoFrameRef = useRef<HTMLIFrameElement | null>(null);
    const youtubePlayerRef = useRef<any>(null);
    const videoResumeTimesRef = useRef<Record<string, number>>({});

    const isDiscounted = !course.isFree
        && course.discountActive
        && course.discountPrice !== undefined
        && course.discountPrice !== null
        && course.discountPrice < course.price;
    const certificateEnabled = !(
        course.certificateEnabled === false ||
        course.certificateEnabled === "false" ||
        course.certificateEnabled === 0 ||
        course.certificateEnabled === "0"
    );
    const effectivePrice = course.isFree ? 0 : (isDiscounted ? course.discountPrice : course.price);

    // Payment Form State
    const [paymentForm, setPaymentForm] = useState({ fullName: "", phoneNumber: "", notes: "" });
    const [paymentStatus, setPaymentStatus] = useState("idle"); // idle, submitting, success, error

    const isCourseLocked = course.isLocked;
    const storageKey = `course:${course._id}:currentSection`;
    const videoResumeStorageKey = `course:${course._id}:videoResumeTimes`;

    const formatVideoTime = (seconds: number) => {
        const safeSeconds = Math.max(0, Math.floor(seconds));
        const mins = Math.floor(safeSeconds / 60);
        const secs = safeSeconds % 60;
        return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    };

    const persistVideoStopTime = (sectionId: string, seconds: number) => {
        if (!sectionId || !Number.isFinite(seconds) || seconds < 1) return;

        const normalizedTime = Math.floor(seconds);
        setVideoResumeTimes(prev => {
            const next = { ...prev, [sectionId]: normalizedTime };
            if (typeof window !== "undefined") {
                window.localStorage.setItem(videoResumeStorageKey, JSON.stringify(next));
            }
            return next;
        });
    };

    const closeVideoModal = () => {
        if (activeVideoSectionId && youtubePlayerRef.current?.getCurrentTime) {
            const currentTime = Number(youtubePlayerRef.current.getCurrentTime() || 0);
            persistVideoStopTime(activeVideoSectionId, currentTime);
        }

        if (youtubePlayerRef.current?.destroy) {
            youtubePlayerRef.current.destroy();
            youtubePlayerRef.current = null;
        }

        setShowVideoModal(false);
        setActiveVideoId(null);
        setActiveVideoSectionId(null);
    };

    const openVideoModal = (videoId: string, sectionId: string) => {
        setActiveVideoId(videoId);
        setActiveVideoSectionId(sectionId);
        setShowVideoModal(true);
    };

    // Restore last viewed section on refresh
    useEffect(() => {
        if (!course?.sections?.length) return;
        const storedId = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
        if (storedId) {
            const match = course.sections.find((s: any) => String(s._id) === String(storedId));
            if (match) {
                setCurrentSection(match);
            }
        }
    }, [course?._id, course?.sections, storageKey]);

    // Save current section on change
    useEffect(() => {
        if (!currentSection?._id) return;
        if (typeof window === "undefined") return;
        window.localStorage.setItem(storageKey, String(currentSection._id));
    }, [currentSection?._id, storageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const raw = window.localStorage.getItem(videoResumeStorageKey);
        if (!raw) return;

        try {
            const parsed = JSON.parse(raw) as Record<string, number>;
            setVideoResumeTimes(parsed || {});
        } catch {
            setVideoResumeTimes({});
        }
    }, [videoResumeStorageKey]);

    useEffect(() => {
        videoResumeTimesRef.current = videoResumeTimes;
    }, [videoResumeTimes]);

    useEffect(() => {
        if (!showVideoModal || !activeVideoId || !activeVideoSectionId) return;

        let cancelled = false;

        const mountPlayer = () => {
            if (cancelled || !window.YT?.Player) return;

            if (youtubePlayerRef.current?.destroy) {
                youtubePlayerRef.current.destroy();
            }

            youtubePlayerRef.current = new window.YT.Player("course-video-player", {
                events: {
                    onReady: (event: any) => {
                        const resumeAt = videoResumeTimesRef.current[activeVideoSectionId] || 0;
                        if (resumeAt > 0) {
                            event.target.seekTo(resumeAt, true);
                        }
                    },
                    onStateChange: (event: any) => {
                        const playerState = window.YT?.PlayerState;
                        if (!playerState) return;

                        if (event.data === playerState.PAUSED || event.data === playerState.ENDED) {
                            const currentTime = Number(event.target?.getCurrentTime?.() || 0);
                            persistVideoStopTime(activeVideoSectionId, currentTime);
                        }
                    }
                }
            });
        };

        if (window.YT?.Player) {
            mountPlayer();
        } else {
            const prevReady = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                prevReady?.();
                mountPlayer();
            };

            const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
            if (!existingScript) {
                const script = document.createElement("script");
                script.src = "https://www.youtube.com/iframe_api";
                document.body.appendChild(script);
            }
        }

        return () => {
            cancelled = true;
        };
    }, [showVideoModal, activeVideoId, activeVideoSectionId]);

    // Check if all sections are completed for certificate eligibility
    const allSectionsCompleted = course.sections.every((s: any) => completedSections.includes(s._id));

    const getVideoId = (url?: string) => {
        if (!url) return "";
        let videoId = "";
        try {
            if (url.includes("v=")) {
                videoId = url.split("v=")[1].split("&")[0];
            } else if (url.includes("youtu.be/")) {
                videoId = url.split("youtu.be/")[1].split("?")[0];
            } else if (url.includes("embed/")) {
                videoId = url.split("embed/")[1].split("?")[0];
            }
            if (videoId.indexOf("?") !== -1) videoId = videoId.split("?")[0];
            if (videoId.indexOf("/") !== -1) videoId = videoId.split("/")[0];
        } catch (e) {
            console.error("Video parse error", e);
        }
        return videoId;
    };

    const enterFullscreen = () => {
        const el = videoFrameRef.current as any;
        if (!el) return;
        if (el.requestFullscreen) return el.requestFullscreen();
        if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
        if (el.mozRequestFullScreen) return el.mozRequestFullScreen();
        if (el.msRequestFullscreen) return el.msRequestFullscreen();
    };

    const showXPGain = (amount: number, reason: string) => {
        setXpGained({ amount, reason });
        setTimeout(() => setXpGained(null), 3000);
    };

    const handleComplete = async (sectionId: string) => {
        if (!user) {
            router.push("/login");
            return;
        }
        if (completedSections.includes(sectionId)) return;

        try {
            const res = await fetch("/api/progress/complete-section", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sectionId, courseId: course._id }),
            });
            const data = await res.json();

            if (data.success) {
                setCompletedSections([...completedSections, sectionId]);
                if (data.xpReasons?.length) {
                    const [first, second] = data.xpReasons;
                    if (first?.amount > 0) {
                        showXPGain(first.amount, first.reason);
                    }
                    if (second?.amount > 0) {
                        setTimeout(() => showXPGain(second.amount, second.reason), 3200);
                    }
                } else if (data.xpResult?.xpAwarded > 0) {
                    showXPGain(data.xpResult.xpAwarded, "Section completed");
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const submitUnlockRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            router.push("/login");
            return;
        }
        setPaymentStatus("submitting");
        try {
            const res = await fetch(`/api/courses/${course._id}/unlock`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: paymentForm.fullName,
                    phoneNumber: paymentForm.phoneNumber,
                    transactionNotes: paymentForm.notes
                }),
            });

            if (res.ok) {
                setPaymentStatus("success");
                setIsPendingAccess(true); // Set local pending state
                setTimeout(() => {
                    setShowUnlockModal(false);
                    setPaymentStatus("idle");
                }, 2000);
            } else {
                setPaymentStatus("error");
            }
        } catch (e) {
            setPaymentStatus("error");
        }
    };

    // Certificate Form State
    const [showCertificateModal, setShowCertificateModal] = useState(false);
    const [certForm, setCertForm] = useState({ fullName: "", phoneNumber: "" });
    const [certStatus, setCertStatus] = useState("idle");

    const submitCertificateRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            router.push("/login");
            return;
        }
        setCertStatus("submitting");
        try {
            const res = await fetch("/api/certificates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    courseId: course._id,
                    fullName: certForm.fullName,
                    phoneNumber: certForm.phoneNumber
                }),
            });

            if (res.ok) {
                setCertStatus("success");
                setTimeout(() => {
                    setShowCertificateModal(false);
                    setCertStatus("idle");
                }, 2000);
            } else {
                setCertStatus("error");
            }
        } catch (e) {
            setCertStatus("error");
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 min-h-[calc(100vh-80px)]">
            {/* Sidebar: Sections List */}
            <div className="w-full lg:w-1/4 bg-slate-900 border-r border-slate-700 overflow-y-auto max-h-[32vh] sm:max-h-[45vh] lg:max-h-none lg:h-auto">
                <div className="p-3 sm:p-4 border-b border-slate-700 font-heading text-base sm:text-lg">
                    STAGES
                </div>
                {/* Certificate / Access Button Section */}
                {(isCourseLocked || certificateEnabled) && (
                    <div className="border-b border-slate-800 bg-slate-800/20">
                        {!isCourseLocked ? (
                            <div className="p-3 sm:p-4">
                                {!allSectionsCompleted ? (
                                    <div className="w-full flex flex-col items-center justify-center gap-1 p-3 bg-slate-800/50 text-slate-500 border border-slate-700 rounded font-mono text-sm cursor-not-allowed text-center">
                                        <Award className="w-4 h-4" />
                                        <span className="text-[10px]">Complete all sections to claim award</span>
                                    </div>
                                ) : hasPendingCertificate ? (
                                    <div className="w-full flex items-center justify-center gap-2 p-3 bg-yellow-500/10 text-yellow-500 border border-yellow-500/50 rounded font-mono text-xs cursor-not-allowed">
                                        <Award className="w-4 h-4" /> CERTIFICATE PENDING
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowCertificateModal(true)}
                                        className="w-full flex items-center justify-center gap-2 p-3 bg-yellow-500/10 text-yellow-500 border border-yellow-500/50 hover:bg-yellow-500/20 transition rounded font-mono text-sm"
                                    >
                                        <Award className="w-4 h-4" /> CLAIM CERTIFICATE
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="p-3 sm:p-4">
                                {isPendingAccess ? (
                                    <div className="w-full p-3 bg-yellow-500/10 text-yellow-500 border border-yellow-500/50 rounded font-mono text-[10px] sm:text-xs text-center flex items-center justify-center gap-2">
                                        <Lock className="w-3 h-3" /> VERIFICATION PENDING
                                    </div>
                                ) : (
                                    <GameButton
                                        variant="secondary"
                                        className="w-full text-[10px] sm:text-xs font-press-start shadow-[0_0_15px_rgba(255,0,255,0.3)]"
                                        onClick={() => setShowUnlockModal(true)}
                                    >
                                        REQUEST ACCESS
                                    </GameButton>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-col">
                    {course.sections.map((section: any, index: number) => {
                        const isCompleted = completedSections.includes(section._id);
                        const isActive = currentSection?._id === section._id;
                        const isLocked = section.isLocked;

                        return (
                            <button
                                key={section._id}
                                onClick={() => setCurrentSection(section)}
                                className={`p-3 sm:p-4 text-left border-b border-slate-800 transition-colors flex items-center justify-between
                            ${isActive ? "bg-primary/20 text-primary border-l-4 border-l-primary" : "text-slate-400 hover:bg-slate-800"}
                            ${isLocked ? "opacity-70 group" : ""}
                        `}
                            >
                                <div className="flex flex-col">
                                    <span className="text-xs sm:text-sm font-mono mb-1">STAGE {index + 1}</span>
                                    <span className="font-bold text-sm sm:text-base">{section.title}</span>
                                </div>
                                <div>
                                    {isLocked ? <Lock className="w-4 h-4" /> : isCompleted ? <CheckCircle className="w-4 h-4 text-primary" /> : null}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="w-full lg:w-3/4 p-4 sm:p-6 relative">

                {/* XP Toast */}
                {xpGained && (
                    <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 animate-bounce bg-primary text-black font-heading px-3 sm:px-4 py-2 rounded shadow-[0_0_20px_var(--color-primary)] z-[10060] text-sm sm:text-base max-w-[70vw]">
                        +{xpGained.amount} XP
                        <div className="text-[10px] font-mono text-black/70 break-words">
                            {xpGained.reason}
                        </div>
                    </div>
                )}

                {isCourseLocked && !course.sections.some((s: any) => !s.isLocked) ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                        <Lock className="w-20 h-20 text-slate-600 mb-6" />
                        <h2 className="text-xl sm:text-3xl font-heading mb-4">ACCESS DENIED</h2>
                        <p className="max-w-md text-slate-400 mb-8">This mission requires clearance level: PAID. Please submit a request to unlock.</p>

                        {isPendingAccess ? (
                            <div className="flex flex-col items-center gap-2 max-w-md mx-auto p-4 bg-yellow-500/10 border border-yellow-500/50 rounded">
                                <h3 className="text-yellow-500 font-heading">VERIFICATION PENDING</h3>
                                <p className="text-slate-400 text-sm">Your payment is being verified by an admin. You will gain access shortly.</p>
                            </div>
                        ) : (
                            <GameButton size="lg" onClick={() => setShowUnlockModal(true)}>REQUEST ACCESS</GameButton>
                        )}
                    </div>
                ) : (
                    <>
                        {currentSection ? (
                            <div className="h-full flex flex-col">
                                <header className="mb-6 sm:mb-8 border-b border-slate-700 pb-4 sm:pb-6">
                                    <h2 className="text-2xl sm:text-3xl lg:text-5xl font-heading text-primary text-shadow break-words">{currentSection.title}</h2>
                                </header>

                                {currentSection.isLocked ? (
                                    <div className="flex-grow flex flex-col items-center justify-center bg-black/30 border border-slate-700 rounded p-8">
                                        <Lock className="w-16 h-16 text-arcade mb-4" />
                                        <h3 className="text-xl sm:text-2xl font-heading text-arcade mb-2">RESTRICTED AREA</h3>
                                        {/* Improved Price Display */}
                                        <div className="flex flex-col items-center gap-2 mb-6">
                                            <span className="text-slate-400 font-mono text-center">Unlock Full Access for Only</span>
                                            {course.isFree ? (
                                                <span className="text-2xl sm:text-3xl md:text-4xl font-heading text-primary drop-shadow-[0_0_15px_rgba(57,255,20,0.5)]">FREE</span>
                                            ) : (
                                                <div className="flex flex-col items-center">
                                                    {course.discountPrice !== undefined && course.discountPrice !== null && course.discountPrice < course.price ? (
                                                        <>
                                                            <span className="text-sm font-mono text-slate-500 line-through decoration-arcade mb-1">{course.price} EGP</span>
                                                            <span className="text-2xl sm:text-3xl md:text-4xl font-heading text-primary drop-shadow-[0_0_15px_rgba(57,255,20,0.5)] animate-pulse">
                                                                {course.discountPrice} EGP
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-2xl sm:text-3xl md:text-4xl font-heading text-primary drop-shadow-[0_0_15px_rgba(57,255,20,0.5)]">
                                                            {course.price} EGP
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-slate-400 mb-6 text-center max-w-sm">To access this stage and the rest of the mission, you must unlock the full course with a one-time payment.</p>

                                        {isPendingAccess ? (
                                            <div className="flex flex-col items-center gap-2 max-w-md mx-auto p-4 bg-yellow-500/10 border border-yellow-500/50 rounded">
                                                <h3 className="text-yellow-500 font-heading">VERIFICATION PENDING</h3>
                                                <p className="text-slate-400 text-sm">Access request submitted. Please wait for admin approval.</p>
                                            </div>
                                        ) : (
                                            <GameButton variant="secondary" size="lg" onClick={() => setShowUnlockModal(true)} className="animate-pulse shadow-[0_0_20px_var(--color-secondary)]">
                                                REQUEST ACCESS
                                            </GameButton>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex-grow">
                                        {/* Dynamic Content Based on Type */}
                                        {(() => {
                                            const type = currentSection.type || (currentSection.videoUrl ? "video" : currentSection.linkUrl ? "link" : "text");

                                            switch (type) {
                                                case "video":
                                                    return (
                                                        <>
                                                            {currentSection.videoUrl && (
                                                                <>
                                                                    <div className="aspect-video bg-black mb-6 rounded border-2 border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden relative">
                                                                        {(() => {
                                                                            const videoId = getVideoId(currentSection.videoUrl);

                                                                            if (videoId) {
                                                                                return (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            openVideoModal(videoId, String(currentSection._id));
                                                                                        }}
                                                                                        className="w-full h-full relative group"
                                                                                        aria-label="Play video"
                                                                                    >
                                                                                        <img
                                                                                            src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                                                                                            alt={currentSection.title}
                                                                                            className="w-full h-full object-cover"
                                                                                        />
                                                                                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition" />
                                                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                                                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                                                                                                <span className="sr-only">Play</span>
                                                                                                <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                                                                                                    <path d="M8 5v14l11-7z" />
                                                                                                </svg>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="absolute bottom-3 left-3 right-3 text-xs font-mono text-white/90 bg-black/60 px-3 py-2 rounded border border-white/10 text-center">
                                                                                            TAP TO PLAY
                                                                                        </div>
                                                                                    </button>
                                                                                );
                                                                            }

                                                                            return (
                                                                                <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                                                                                    Invalid Video Link
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                    {!!videoResumeTimes[String(currentSection._id)] && (
                                                                        <div className="mb-6 bg-primary/10 border border-primary/40 rounded p-3 text-center">
                                                                            <p className="text-sm sm:text-base font-mono text-primary">
                                                                                LAST WATCHED POINT: {formatVideoTime(videoResumeTimes[String(currentSection._id)])}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                    {/* Video Security Disclaimer */}
                                                                    <div className="mb-6 p-3 bg-red-400/10 border border-red-400/20 rounded flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-full bg-red-400/20 flex items-center justify-center shrink-0">
                                                                            <span className="text-red-400 text-lg">🔒</span>
                                                                        </div>
                                                                        <div className="text-xs md:text-sm font-mono text-slate-400">
                                                                            <span className="text-red-400 font-bold uppercase mr-2">Security Protocol:</span>
                                                                            This video is unlisted and provided strictly for <span className="text-white">your account only</span>. Distribution of this link is prohibited and monitored.
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            )}
                                                            <div
                                                                className="prose prose-invert max-w-none text-slate-300 font-sans leading-relaxed whitespace-pre-wrap text-base sm:text-lg md:text-2xl break-words"
                                                            >
                                                                {currentSection.content}
                                                            </div>
                                                        </>
                                                    );
                                                case "link":
                                                    return (
                                                        <div className="flex flex-col items-center justify-center p-12 border border-slate-800 bg-slate-900 rounded mb-6">
                                                            <h3 className="text-xl font-heading text-secondary mb-4">EXTERNAL RESOURCE</h3>
                                                            <p className="text-slate-400 mb-6 text-center max-w-md">{currentSection.content || "Access the external material for this stage."}</p>
                                                            <a
                                                                href={currentSection.linkUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="bg-secondary/20 text-secondary border border-secondary px-6 py-3 rounded hover:bg-secondary/30 transition flex items-center gap-2 font-mono"
                                                            >
                                                                OPEN RESOURCE
                                                            </a>
                                                        </div>
                                                    );
                                                case "quiz":
                                                    return (
                                                        <QuizView
                                                            sectionId={currentSection._id}
                                                            questions={currentSection.questions || []}
                                                            answeredQuestions={answeredQuestions}
                                                            isCompleted={completedSections.includes(currentSection._id)}
                                                            onXPGain={(amount, reason) => {
                                                                showXPGain(amount, reason);
                                                            }}
                                                            onAnswerCorrect={(id: string) => {
                                                                if (!answeredQuestions.includes(id)) {
                                                                    setAnsweredQuestions(prev => [...prev, id]);
                                                                }
                                                            }}
                                                        />
                                                    );
                                                default: // text
                                                    return (
                                                        <div
                                                            className="prose prose-invert max-w-none text-slate-300 font-sans leading-relaxed whitespace-pre-wrap text-base sm:text-lg md:text-2xl break-words"
                                                        >
                                                            {currentSection.content}
                                                        </div>
                                                    );
                                            }
                                        })()}

                                        <div className="mt-12 pt-6 border-t border-slate-700 flex justify-end">
                                            <GameButton
                                                size="lg"
                                                onClick={() => handleComplete(currentSection._id)}
                                                disabled={completedSections.includes(currentSection._id)}
                                                className={completedSections.includes(currentSection._id) ? "opacity-50" : ""}
                                            >
                                                {completedSections.includes(currentSection._id) ? "MISSION COMPLETED" : "MARK COMPLETE (+50 XP)"}
                                            </GameButton>

                                            {/* Next Stage Button */}
                                            {(() => {
                                                const currentIndex = course.sections.findIndex((s: any) => s._id === currentSection._id);
                                                const nextSection = course.sections[currentIndex + 1];

                                                if (nextSection && completedSections.includes(currentSection._id)) {
                                                    return (
                                                        <GameButton
                                                            size="lg"
                                                            variant="secondary"
                                                            className="ml-4 animate-pulse"
                                                            onClick={() => setCurrentSection(nextSection)}
                                                        >
                                                            NEXT STAGE <ArrowRight className="w-4 h-4 ml-2" />
                                                        </GameButton>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-500 font-mono">
                                Select a stage to begin...
                            </div>
                        )}
                    </>
                )
                }
            </div >

            {showVideoModal && activeVideoId && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10060] flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl">
                        <div className="flex justify-between items-center mb-2">
                            <button
                                onClick={enterFullscreen}
                                className="text-slate-300 hover:text-white font-mono text-sm"
                            >
                                FULL SCREEN
                            </button>
                            <button
                                onClick={() => {
                                    closeVideoModal();
                                }}
                                className="text-slate-300 hover:text-white font-mono text-sm"
                            >
                                CLOSE
                            </button>
                        </div>
                        <div className="aspect-video bg-black rounded border-2 border-slate-800 overflow-hidden">
                            <iframe
                                id="course-video-player"
                                ref={videoFrameRef}
                                src={`https://www.youtube-nocookie.com/embed/${activeVideoId}?autoplay=1&playsinline=1&modestbranding=1&rel=0&iv_load_policy=3&fs=1&enablejsapi=1`}
                                title="Course video"
                                className="w-full h-full pointer-events-auto"
                                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Unlock Modal */}
            {
                showUnlockModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10050] overflow-y-auto flex items-start sm:items-center justify-center p-3 sm:p-4 py-6 sm:py-4">
                        <GameCard className="w-full max-w-sm sm:max-w-lg bg-slate-900 border-primary shadow-[0_0_50px_rgba(57,255,20,0.1)] my-auto p-4 sm:p-6">
                            <h3 className="text-xl sm:text-2xl font-heading text-primary mb-2 text-center">UNLOCK ACCESS</h3>
                            <div className="text-center mb-4 sm:mb-6">
                                {course.isFree ? (
                                    <span className="text-2xl sm:text-3xl font-heading text-white">FREE</span>
                                ) : isDiscounted ? (
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs font-mono text-slate-400 line-through">{course.price} EGP</span>
                                        <span className="text-2xl sm:text-3xl font-heading text-white">{course.discountPrice} EGP</span>
                                    </div>
                                ) : (
                                    <span className="text-2xl sm:text-3xl font-heading text-white">{course.price} EGP</span>
                                )}
                            </div>
                            <p className="text-slate-400 text-sm sm:text-base mb-5 sm:mb-6 font-mono leading-relaxed">
                                To unlock this mission pack, please transfer the fee via Instapay and submit your details below. An admin will verify your clearance.
                            </p>

                            {paymentStatus === "success" ? (
                                <div className="bg-green-500/10 border border-green-500 text-green-500 p-6 text-center">
                                    <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                                    <h4 className="font-heading text-xl">REQUEST SENT</h4>
                                    <p className="text-sm">Please wait for admin approval. You will be contacted shortly.</p>
                                </div>
                            ) : (
                                <form onSubmit={submitUnlockRequest} className="space-y-4">
                                    {/* Payment Instructions */}
                                    <div className="bg-arcade/10 border border-arcade/50 rounded p-3 sm:p-4 mb-4">
                                        <h4 className="font-heading text-arcade text-xs sm:text-sm mb-2">📱 PAYMENT INSTRUCTIONS</h4>
                                        <ol className="text-xs sm:text-sm text-slate-300 space-y-2 font-mono list-decimal list-inside">
                                            <li>Send <span className="text-white font-bold">{effectivePrice || 0} EGP</span> via Instapay</li>
                                            <li>Take a screenshot of the transaction</li>
                                            <li>Send screenshot to WhatsApp: <span className="text-white font-bold">01022138836</span></li>
                                            <li>Fill the form below and submit</li>
                                        </ol>
                                    </div>

                                    <div className="bg-slate-800 p-3 sm:p-4 rounded border border-slate-700 mb-4 flex items-center gap-3 sm:gap-4">
                                        <Smartphone className="w-7 h-7 sm:w-8 sm:h-8 text-arcade" />
                                        <div>
                                            <div className="text-xs text-slate-400">INSTAPAY / WHATSAPP</div>
                                            <div className="font-mono text-lg sm:text-xl text-white">01022138836</div>
                                        </div>
                                    </div>

                                    <GameInput
                                        label="Your Full Name"
                                        required
                                        value={paymentForm.fullName}
                                        onChange={e => setPaymentForm({ ...paymentForm, fullName: e.target.value })}
                                    />
                                    <GameInput
                                        label="WhatsApp Number"
                                        required
                                        value={paymentForm.phoneNumber}
                                        placeholder="+20 1xx ..."
                                        onChange={e => setPaymentForm({ ...paymentForm, phoneNumber: e.target.value })}
                                    />
                                    <GameInput
                                        label="Transaction Ref / Notes (Optional)"
                                        value={paymentForm.notes}
                                        onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                    />

                                    <div className="flex flex-col-reverse sm:flex-row gap-4 mt-6">
                                        <GameButton type="button" variant="ghost" className="w-full sm:flex-1" onClick={() => setShowUnlockModal(false)}>CANCEL</GameButton>
                                        <GameButton type="submit" className="w-full sm:flex-1" disabled={paymentStatus === "submitting"}>
                                            {paymentStatus === "submitting" ? "TRANSMITTING..." : "SUBMIT REQUEST"}
                                        </GameButton>
                                    </div>
                                    {paymentStatus === "error" && (
                                        <p className="text-red-500 text-xs text-center mt-2">Transmission failed. Try again.</p>
                                    )}
                                </form>
                            )}
                        </GameCard>
                    </div>
                )
            }

            {/* Certificate Modal */}
            {
                showCertificateModal && certificateEnabled && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10050] overflow-y-auto flex items-start sm:items-center justify-center p-3 sm:p-4 py-6 sm:py-4">
                        <GameCard className="w-full max-w-sm sm:max-w-lg bg-slate-900 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.1)] my-auto p-4 sm:p-6">
                            <Award className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-500 mb-4 mx-auto" />
                            <h3 className="text-xl sm:text-2xl font-heading text-yellow-500 mb-2 text-center">CLAIM YOUR CERTIFICATE</h3>
                            <p className="text-slate-400 text-xs sm:text-sm mb-6 font-mono text-center">
                                Congratulations on completing the mission! Enter your details to receive your official certification.
                            </p>

                            {certStatus === "success" ? (
                                <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-500 p-6 text-center">
                                    <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                                    <h4 className="font-heading text-xl">APPLICATION RECEIVED</h4>
                                    <p className="text-sm">We will contact you shortly.</p>
                                </div>
                            ) : (
                                <form onSubmit={submitCertificateRequest} className="space-y-4">
                                    <GameInput
                                        label="Full Name (for Certificate)"
                                        required
                                        value={certForm.fullName}
                                        onChange={e => setCertForm({ ...certForm, fullName: e.target.value })}
                                    />
                                    <GameInput
                                        label="WhatsApp Number"
                                        required
                                        value={certForm.phoneNumber}
                                        placeholder="+20 1xx ..."
                                        onChange={e => setCertForm({ ...certForm, phoneNumber: e.target.value })}
                                    />

                                    <div className="flex gap-4 mt-6">
                                        <GameButton type="button" variant="ghost" className="flex-1" onClick={() => setShowCertificateModal(false)}>CANCEL</GameButton>
                                        <GameButton type="submit" className="flex-1 bg-yellow-600 hover:bg-yellow-500" disabled={certStatus === "submitting"}>
                                            {certStatus === "submitting" ? "TRANSMITTING..." : "SUBMIT APPLICATION"}
                                        </GameButton>
                                    </div>
                                    {certStatus === "error" && (
                                        <p className="text-red-500 text-xs text-center mt-2">Transmission failed. Try again.</p>
                                    )}
                                </form>
                            )}
                        </GameCard>
                    </div>
                )
            }
        </div >
    );
}
