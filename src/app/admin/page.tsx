"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminStats } from "@/components/admin/AdminStats";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { AdminCertificates } from "@/components/admin/AdminCertificates";
import { AdminCourseDashboard } from "@/components/admin/AdminCourseDashboard";
import { GameButton } from "@/components/ui/GameButton";
import { CheckCircle, XCircle, Trash } from "lucide-react";

// Interfaces
interface Request {
    _id: string;
    userId: { _id: string; name: string; email: string };
    courseId: { _id: string; title: string; price: number; discountPrice?: number; discountActive?: boolean };
    status: string;
    paymentDetails: { fullName: string; phoneNumber: string; transactionNotes: string; amount: number };
    createdAt: string;
}

interface Course {
    _id: string;
    title: string;
    isFeatured: boolean;
    sections: any[];
    price: number;
    isFree: boolean;
    certificateEnabled?: boolean;
}

interface ContactMessage {
    _id: string;
    name: string;
    phone: string;
    message: string;
    source: string;
    createdAt: string;
}

export default function AdminDashboard() {
    const [currentView, setCurrentView] = useState("overview");
    const [requests, setRequests] = useState<Request[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [messages, setMessages] = useState<ContactMessage[]>([]);
    const [usersCount, setUsersCount] = useState(0);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Course Management State
    const [showCreateCourse, setShowCreateCourse] = useState(false);
    const [newCourse, setNewCourse] = useState({
        title: "",
        description: "",
        price: 0,
        isFree: false,
        isFeatured: false,
        certificateEnabled: true,
        thumbnail: "",
        difficulty: "beginner",
        discountPrice: 0,
        discountActive: false
    });
    const [uploading, setUploading] = useState(false);
    const [courseSearch, setCourseSearch] = useState("");

    const router = useRouter();

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        await Promise.all([fetchRequests(), fetchCourses(), fetchUsersCount(), fetchMessages()]);
        setLoading(false);
    };

    const fetchUsersCount = async () => {
        try {
            // Fetch basic list for analytics/count (no populated fields)
            const res = await fetch("/api/admin/users");
            if (res.ok) {
                const data = await res.json();
                setUsersCount(data.users.length);
                setAllUsers(data.users);
            }
        } catch (e) { console.error(e); }
    };

    // Effect to load full user details only when viewing the Users tab
    useEffect(() => {
        if (currentView === "users") {
            const fetchUserDetails = async () => {
                try {
                    setLoading(true);
                    const res = await fetch("/api/admin/users?details=true");
                    if (res.ok) {
                        const data = await res.json();
                        setAllUsers(data.users);
                    }
                } catch (e) { console.error(e); } finally {
                    setLoading(false);
                }
            };
            fetchUserDetails();
        }
    }, [currentView]);

    const fetchCourses = async () => {
        try {
            const res = await fetch("/api/courses");
            if (res.ok) {
                const data = await res.json();
                setCourses(data.courses);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchRequests = async () => {
        try {
            const res = await fetch("/api/admin/requests");
            if (res.ok) {
                const data = await res.json();
                setRequests(data.requests);
            } else {
                if (res.status === 401 || res.status === 403) {
                    setLoading(false);
                    // Instead of redirecting, we stay here and show access denied
                    return;
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchMessages = async () => {
        try {
            const res = await fetch("/api/admin/messages");
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages);
            } else {
                router.push("/login");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const getApprovedPaidAmount = (req: Request) => {
        if (req.status !== "approved") return 0;
        if (!req.courseId) return 0;

        // Check if discount was active for this course
        if (req.courseId.discountActive && req.courseId.discountPrice !== undefined) {
            return req.courseId.discountPrice;
        }

        // Fallback to payment details amount if available, otherwise original price
        const amount = req.paymentDetails?.amount || req.courseId.price || 0;
        return amount > 0 ? amount : 0;
    };

    const handleAction = async (id: string, status: "approved" | "rejected") => {
        try {
            const res = await fetch(`/api/admin/requests/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                setRequests(requests.filter(r => r._id !== id));
            }
        } catch (e) { console.error(e); }
    };


    const handleDeleteRequest = async (id: string) => {
        if (!confirm("Are you sure you want to remove this request record?")) return;
        try {
            const res = await fetch(`/api/admin/requests/${id}`, { method: "DELETE" });
            if (res.ok) {
                setRequests(requests.filter(r => r._id !== id));
            }
        } catch (e) { console.error(e); }
    };

    const handleDeleteMessage = async (id: string) => {
        if (!confirm("Delete this message?")) return;
        try {
            const res = await fetch(`/api/admin/messages/${id}`, { method: "DELETE" });
            if (res.ok) {
                setMessages(messages.filter(m => m._id !== id));
            }
        } catch (e) { console.error(e); }
    };

    const toggleFeatured = async (courseId: string, currentStatus: boolean) => {
        try {
            const res = await fetch(`/api/courses/${courseId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isFeatured: !currentStatus }),
            });

            if (res.ok) {
                setCourses(courses.map(c =>
                    c._id === courseId ? { ...c, isFeatured: !currentStatus } : c
                ));
            }
        } catch (e) { console.error(e); }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            const data = await res.json();
            if (!res.ok) {
                alert(data?.error || "Upload failed");
                return;
            }

            setNewCourse({ ...newCourse, thumbnail: data.url });
        } catch (err) {
            console.error(err);
            alert("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleCreateCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch("/api/courses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newCourse)
            });
            if (res.ok) {
                alert("Course Created!");
                setShowCreateCourse(false);
                setNewCourse({
                    title: "",
                    description: "",
                    price: 0,
                    isFree: false,
                    isFeatured: false,
                    certificateEnabled: true,
                    thumbnail: "",
                    difficulty: "beginner",
                    discountPrice: 0,
                    discountActive: false
                });
                fetchCourses();
            }
        } catch (e) { alert("Error creating course"); }
    };

    const grantCourseAccess = async (userId: string, courseId: string) => {
        try {
            const res = await fetch(`/api/admin/users/${userId}/grant-access`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId })
            });
            if (res.ok) {
                await fetchUsersCount();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteCourse = async (courseId: string, title: string) => {
        if (!confirm(`Delete "${title}" and all its sections? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
            if (res.ok) {
                setCourses(courses.filter(c => c._id !== courseId));
                await fetchUsersCount();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to delete course");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to delete course");
        }
    };

    const revokeCourseAccess = async (userId: string, courseId: string) => {
        try {
            const res = await fetch(`/api/admin/users/${userId}/grant-access`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId })
            });
            if (res.ok) {
                await fetchUsersCount();
            }
        } catch (e) {
            console.error(e);
        }
    };



    // If data load failed due to auth, show manual entry
    if (!loading && requests.length === 0 && courses.length === 0 && usersCount === 0) {
        return (
            <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
                <div className="w-full max-w-md bg-slate-900 border border-slate-700 p-8 rounded-lg text-center">
                    <h1 className="text-3xl font-heading text-red-500 mb-4">RESTRICTED AREA</h1>
                    <p className="text-slate-400 font-mono mb-8">
                        Secure connection failed. Please re-authenticate.
                    </p>
                    <GameButton size="lg" onClick={() => router.push("/login")}>
                        LOGIN AS ADMIN
                    </GameButton>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 text-white flex flex-col lg:flex-row">
            <AdminSidebar currentView={currentView} setCurrentView={setCurrentView} />

            <div className="flex-1 p-6 lg:p-10 overflow-y-auto max-h-screen">
                <header className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
                    <div>
                        <h1 className="text-3xl font-heading text-white">{currentView.replace("-", " ").toUpperCase()}</h1>
                        <p className="text-slate-500 font-mono text-sm">SYSTEM STATUS: OPERATIONAL</p>
                    </div>
                    <GameButton variant="ghost" onClick={() => router.push("/dashboard")}>EXIT DASHBOARD</GameButton>
                </header>

                {currentView === "overview" && (
                    <>
                        <AdminStats
                            usersCount={usersCount}
                            coursesCount={courses.length}
                            pendingRequests={requests.filter(r => r.status === "pending").length}
                            totalRevenue={requests.reduce((acc, req) => {
                                const amount = getApprovedPaidAmount(req);
                                return acc + amount;
                            }, 0)}
                            dailyRevenue={requests.reduce((acc, req) => {
                                const amount = getApprovedPaidAmount(req);
                                if (amount <= 0) return acc;
                                const reqDate = new Date(req.createdAt).toDateString();
                                const today = new Date().toDateString();
                                return reqDate === today ? acc + amount : acc;
                            }, 0)}
                            monthlyRevenue={requests.reduce((acc, req) => {
                                const amount = getApprovedPaidAmount(req);
                                if (amount <= 0) return acc;
                                const reqDate = new Date(req.createdAt);
                                const now = new Date();
                                return (reqDate.getMonth() === now.getMonth() && reqDate.getFullYear() === now.getFullYear())
                                    ? acc + amount : acc;
                            }, 0)}
                            bestSellingCourse={(() => {
                                const counts: Record<string, number> = {};
                                requests.filter(r => r.status === "approved" && r.courseId).forEach(r => {
                                    // Handle populated courseId
                                    const title = (r.courseId as any).title || "Unknown";
                                    counts[title] = (counts[title] || 0) + 1;
                                });
                                return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, "") || "No Sales Yet";
                            })()}
                        />
                        <AdminAnalytics users={allUsers} requests={requests} />
                    </>
                )}

                {currentView === "course-dashboard" && (
                    <AdminCourseDashboard
                        courses={courses}
                        users={allUsers}
                        requests={requests}
                        onGrantAccess={grantCourseAccess}
                        onRevokeAccess={revokeCourseAccess}
                    />
                )}

                {currentView === "users" && <AdminUsers />}

                {currentView === "certificates" && <AdminCertificates />}

                {(currentView === "requests" || currentView === "overview") && (
                    <section className={currentView === "overview" ? "" : "animate-fade-in-up"}>
                        {currentView === "overview" && <h2 className="text-xl font-heading text-slate-400 mb-4 mt-8">PENDING REQUESTS</h2>}

                        {loading ? (
                            <div className="text-slate-500 font-mono animate-pulse">Data Stream Loading...</div>
                        ) : requests.filter(r => r.status === "pending").length === 0 ? (
                            <div className="text-slate-600 font-mono border border-slate-800 p-8 text-center rounded">
                                No pending requests found.
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {requests.filter(r => r.status === "pending").map((req) => (
                                    <div key={req._id} className="bg-slate-900 border border-slate-700 p-4 rounded flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div className="flex-grow">
                                            <div className="flex gap-2 mb-1">
                                                <span className="text-xs font-mono bg-primary/20 text-primary px-2 rounded">USER: {req.userId?.name}</span>
                                                <span className="text-xs font-mono bg-secondary/20 text-secondary px-2 rounded">COURSE: {req.courseId?.title}</span>
                                            </div>
                                            <div className="font-mono text-sm text-slate-300">
                                                <span className="text-slate-500">PAYMENT FROM:</span> {req.paymentDetails.fullName} <span className="text-slate-600">|</span> {req.paymentDetails.phoneNumber}
                                            </div>
                                            {req.paymentDetails.transactionNotes && (
                                                <div className="text-xs text-slate-500 mt-1 italic">"{req.paymentDetails.transactionNotes}"</div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <GameButton size="sm" variant="danger" onClick={() => handleDeleteRequest(req._id)} title="Delete Request"><Trash className="w-4 h-4" /></GameButton>
                                            <GameButton size="sm" variant="danger" onClick={() => handleAction(req._id, "rejected")}><XCircle className="w-4 h-4" /></GameButton>
                                            <GameButton size="sm" variant="primary" onClick={() => handleAction(req._id, "approved")}><CheckCircle className="w-4 h-4" /> APPROVE</GameButton>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {currentView === "messages" && (
                    <section className="animate-fade-in-up">
                        <h2 className="text-xl font-heading text-slate-400 mb-4">INBOX</h2>
                        {loading ? (
                            <div className="text-slate-500 font-mono animate-pulse">Data Stream Loading...</div>
                        ) : messages.length === 0 ? (
                            <div className="text-slate-600 font-mono border border-slate-800 p-8 text-center rounded">
                                No messages yet.
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {messages.map((msg) => (
                                    <div key={msg._id} className="bg-slate-900 border border-slate-700 p-4 rounded flex flex-col gap-3">
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                            <div className="flex flex-wrap gap-2 items-center">
                                                <span className="text-xs font-mono bg-primary/20 text-primary px-2 rounded">FROM: {msg.name}</span>
                                                <span className="text-xs font-mono bg-secondary/20 text-secondary px-2 rounded">PHONE: {msg.phone}</span>
                                                <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 rounded">SOURCE: {msg.source}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                                                {new Date(msg.createdAt).toLocaleString()}
                                            </div>
                                        </div>
                                        <p className="text-slate-300 font-mono leading-relaxed">{msg.message}</p>
                                        <div className="flex justify-end">
                                            <GameButton size="sm" variant="danger" onClick={() => handleDeleteMessage(msg._id)} title="Delete Message">
                                                <Trash className="w-4 h-4" />
                                            </GameButton>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {currentView === "courses" && (
                    <section className="animate-fade-in-up">
                        <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
                            <GameButton onClick={() => setShowCreateCourse(!showCreateCourse)}>
                                {showCreateCourse ? "CANCEL CREATE" : "+ CREATE NEW COURSE"}
                            </GameButton>
                            <input
                                type="text"
                                placeholder="Search courses..."
                                className="bg-slate-900 border border-slate-700 p-2 rounded text-white min-w-[250px] focus:outline-none focus:border-primary"
                                value={courseSearch}
                                onChange={(e) => setCourseSearch(e.target.value)}
                            />
                        </div>

                        {showCreateCourse && (
                            <div className="bg-slate-900 border border-primary/50 p-6 rounded shadow-[0_0_20px_rgba(57,255,20,0.1)] mb-8 animate-fade-in-up">
                                <h3 className="text-lg font-heading text-primary mb-4">CREATE NEW COURSE</h3>
                                <form onSubmit={handleCreateCourse} className="space-y-4 max-w-2xl">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <input placeholder="Course Title" className="bg-slate-900 border border-slate-700 p-2 text-white w-full" value={newCourse.title} onChange={e => setNewCourse({ ...newCourse, title: e.target.value })} required />
                                        <select className="bg-slate-950 border border-slate-700 p-2 text-white w-full" value={newCourse.difficulty} onChange={e => setNewCourse({ ...newCourse, difficulty: e.target.value })}>
                                            <option value="beginner">Beginner</option>
                                            <option value="intermediate">Intermediate</option>
                                            <option value="advanced">Advanced</option>
                                        </select>
                                    </div>
                                    <textarea placeholder="Description" className="bg-slate-900 border border-slate-700 p-2 text-white w-full h-24" value={newCourse.description} onChange={e => setNewCourse({ ...newCourse, description: e.target.value })} required />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                        <input
                                            type="number"
                                            placeholder="Price (EGP)"
                                            className="bg-slate-950 border border-slate-700 p-2 text-white w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                            value={newCourse.isFree ? 0 : newCourse.price}
                                            onChange={e => setNewCourse({ ...newCourse, price: Number(e.target.value) })}
                                            disabled={newCourse.isFree}
                                        />
                                        <div className="bg-slate-950 border border-slate-700 p-2 w-full flex items-center gap-2">
                                            <input type="file" accept="image/*" onChange={handleImageUpload} className="text-white text-xs" />
                                            {uploading && <span className="text-secondary text-xs animate-pulse">UPLOADING...</span>}
                                        </div>
                                        {newCourse.thumbnail && <div className="text-xs text-primary truncate px-2">{newCourse.thumbnail}</div>}
                                        <label className="flex items-center gap-2 text-white cursor-pointer"><input type="checkbox" checked={newCourse.isFree} onChange={e => setNewCourse({ ...newCourse, isFree: e.target.checked, price: e.target.checked ? 0 : newCourse.price })} /> Free Access</label>
                                        <label className="flex items-center gap-2 text-white cursor-pointer"><input type="checkbox" checked={newCourse.isFeatured} onChange={e => setNewCourse({ ...newCourse, isFeatured: e.target.checked })} /> Featured</label>
                                        <label className="flex items-center gap-2 text-white cursor-pointer"><input type="checkbox" checked={newCourse.certificateEnabled} onChange={e => setNewCourse({ ...newCourse, certificateEnabled: e.target.checked })} /> Certificate Enabled</label>
                                    </div>

                                    {/* Discount Row */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-slate-950/30 p-3 rounded border border-slate-800">
                                        <label className="flex items-center gap-2 text-yellow-400 cursor-pointer text-sm font-bold">
                                            <input
                                                type="checkbox"
                                                checked={newCourse.discountActive}
                                                onChange={e => setNewCourse({ ...newCourse, discountActive: e.target.checked })}
                                                disabled={newCourse.isFree}
                                            /> 🏷️ Sales Active
                                        </label>
                                        {newCourse.discountActive && !newCourse.isFree && (
                                            <input
                                                type="number"
                                                placeholder="Discount Price (EGP)"
                                                className="bg-slate-950 border border-yellow-500/30 p-2 text-yellow-400 w-full text-sm"
                                                value={newCourse.discountPrice || ""}
                                                onChange={e => setNewCourse({ ...newCourse, discountPrice: Number(e.target.value) })}
                                            />
                                        )}
                                    </div>
                                    <GameButton type="submit">CREATE COURSE</GameButton>
                                </form>
                            </div>
                        )}

                        <div className="grid gap-4">
                            {courses.filter(c => c.title.toLowerCase().includes(courseSearch.toLowerCase())).map(course => (
                                <div key={course._id} className="border border-slate-700 p-4 bg-slate-950 rounded hover:border-slate-500 transition-colors">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <h4 className="font-bold text-lg">{course.title}</h4>
                                                <div className="text-xs text-slate-500 font-mono mt-1">
                                                    {course.sections.length} SECTIONS | {course.isFree ? "FREE" : `${course.price || 0} EGP`}
                                                </div>
                                            </div>
                                            <button onClick={() => toggleFeatured(course._id, course.isFeatured)} className={`px-2 py-0.5 text-xs font-mono rounded border ${course.isFeatured ? "bg-yellow-500/20 text-yellow-500 border-yellow-500" : "bg-slate-800 text-slate-500 border-slate-700"}`}>
                                                {course.isFeatured ? "★ FEATURED" : "☆ NOT FEATURED"}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <GameButton size="sm" onClick={() => router.push(`/admin/courses/${course._id}`)}>
                                                EDIT COURSE
                                            </GameButton>
                                            <GameButton
                                                size="sm"
                                                variant="danger"
                                                onClick={() => handleDeleteCourse(course._id, course.title)}
                                                title="Delete course"
                                            >
                                                <Trash className="w-4 h-4" />
                                            </GameButton>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
