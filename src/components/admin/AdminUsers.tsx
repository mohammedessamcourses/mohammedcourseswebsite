"use client";

import { useState, useEffect } from "react";
import { GameCard } from "@/components/ui/GameCard";
import { GameButton } from "@/components/ui/GameButton";
import { Search, User, BookOpen, Zap, Trophy, Flame, X, Plus, Trash2 } from "lucide-react";

interface UserData {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    xp: number;
    level: number;
    streak: { count: number };
    unlockedCourses: { _id: string; title: string; price: number; isFree: boolean }[];
    completedCourses: { _id: string; title: string }[];
    completedSections: string[];
    createdAt: string;
}

interface Course {
    _id: string;
    title: string;
    price: number;
    isFree: boolean;
}

export function AdminUsers() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");
    const [createForm, setCreateForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "student" as "student" | "admin"
    });
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
    const [xpDelta, setXpDelta] = useState(0);
    const [xpTotal, setXpTotal] = useState(0);
    const [streakCount, setStreakCount] = useState(0);
    const [showGrantModal, setShowGrantModal] = useState(false);
    const [grantUserId, setGrantUserId] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
        fetchCourses();
    }, []);

    const fetchUsers = async (searchQuery?: string) => {
        try {
            const params = new URLSearchParams({ details: "true" });
            if (searchQuery) {
                params.set("search", searchQuery);
            }
            const url = `/api/admin/users?${params.toString()}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

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

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        fetchUsers(search);
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setCreateError("");

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(createForm),
            });

            const data = await res.json();
            if (!res.ok) {
                setCreateError(data.error || "Failed to create user.");
                return;
            }

            setCreateForm({ name: "", email: "", phone: "", password: "", role: "student" });
            fetchUsers(search);
        } catch (e) {
            setCreateError("Failed to create user.");
        } finally {
            setCreating(false);
        }
    };

    const grantAccess = async (userId: string, courseId: string) => {
        try {
            const res = await fetch(`/api/admin/users/${userId}/grant-access`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId })
            });
            if (res.ok) {
                alert("Access granted!");
                fetchUsers(search);
                setShowGrantModal(false);
            }
        } catch (e) {
            alert("Error granting access");
        }
    };

    const revokeAccess = async (userId: string, courseId: string) => {
        if (!confirm("Remove access to this course?")) return;
        try {
            const res = await fetch(`/api/admin/users/${userId}/grant-access`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId })
            });
            if (res.ok) {
                alert("Access revoked");
                fetchUsers(search);
                if (selectedUser) {
                    setSelectedUser({
                        ...selectedUser,
                        unlockedCourses: selectedUser.unlockedCourses.filter(c => c._id !== courseId)
                    });
                }
            }
        } catch (e) {
            alert("Error revoking access");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this user permanently?")) return;
        try {
            const res = await fetch("/api/admin/users", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (res.ok) {
                setUsers(users.filter(u => u._id !== id));
                setSelectedUser(null);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const updateUserStats = async (userId: string, payload: { xpDelta?: number; xpTotal?: number; streakCount?: number }) => {
        try {
            const res = await fetch(`/api/admin/users/${userId}/stats`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.user) {
                setSelectedUser(data.user);
                fetchUsers(search);
            } else {
                alert(data.error || "Update failed");
            }
        } catch (e) {
            alert("Update failed");
        }
    };

    if (loading) return <div className="text-slate-500 font-mono animate-pulse">Loading users...</div>;

    return (
        <div className="space-y-6">
            {/* Create User */}
            <form onSubmit={handleCreateUser} className="bg-slate-900 border border-slate-800 rounded p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                <input
                    type="text"
                    placeholder="Full Name"
                    className="bg-slate-950 border border-slate-700 p-2 text-white"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    required
                />
                <input
                    type="email"
                    placeholder="Email"
                    className="bg-slate-950 border border-slate-700 p-2 text-white"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                />
                <input
                    type="tel"
                    placeholder="Phone"
                    className="bg-slate-950 border border-slate-700 p-2 text-white"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    className="bg-slate-950 border border-slate-700 p-2 text-white"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    required
                />
                <select
                    className="bg-slate-950 border border-slate-700 p-2 text-white"
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as "student" | "admin" })}
                >
                    <option value="student">Student</option>
                    <option value="admin">Admin</option>
                </select>
                <GameButton type="submit" disabled={creating}>
                    {creating ? "CREATING..." : "CREATE USER"}
                </GameButton>
                {createError && (
                    <div className="lg:col-span-6 text-xs text-red-400 font-mono">
                        {createError}
                    </div>
                )}
            </form>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-2">
                <div className="flex-grow relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name or email..."
                        className="w-full bg-slate-900 border border-slate-700 rounded pl-10 pr-4 py-2 text-white placeholder:text-slate-500"
                    />
                </div>
                <GameButton type="submit">SEARCH</GameButton>
            </form>

            {/* Users Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {users.map(user => (
                    <GameCard key={user._id} className="p-4">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-slate-400" />
                                </div>
                                <div>
                                    <div className="font-bold text-white">{user.name}</div>
                                    <div className="text-xs text-slate-500 font-mono">{user.email}</div>
                                </div>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded ${user.role === "admin" ? "bg-red-500/20 text-red-400" : "bg-slate-700 text-slate-400"}`}>
                                {user.role.toUpperCase()}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                            <div className="bg-slate-800/50 p-2 rounded">
                                <Zap className="w-4 h-4 text-yellow-400 mx-auto" />
                                <div className="text-sm font-bold text-white">{user.xp || 0}</div>
                                <div className="text-[10px] text-slate-500">XP</div>
                            </div>
                            <div className="bg-slate-800/50 p-2 rounded">
                                <Trophy className="w-4 h-4 text-primary mx-auto" />
                                <div className="text-sm font-bold text-white">{user.level || 1}</div>
                                <div className="text-[10px] text-slate-500">LVL</div>
                            </div>
                            <div className="bg-slate-800/50 p-2 rounded">
                                <BookOpen className="w-4 h-4 text-secondary mx-auto" />
                                <div className="text-sm font-bold text-white">{user.unlockedCourses?.length || 0}</div>
                                <div className="text-[10px] text-slate-500">COURSES</div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <GameButton size="sm" variant="ghost" className="flex-1" onClick={() => setSelectedUser(user)}>
                                VIEW DETAILS
                            </GameButton>
                            <GameButton size="sm" className="flex-1" onClick={() => { setGrantUserId(user._id); setShowGrantModal(true); }}>
                                <Plus className="w-3 h-3" /> GRANT
                            </GameButton>
                        </div>
                    </GameCard>
                ))}
            </div>

            {users.length === 0 && (
                <div className="text-center py-12 text-slate-500 font-mono">
                    No users found.
                </div>
            )}

            {/* User Details Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <GameCard className="w-full max-w-2xl bg-slate-900 max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-heading text-white">{selectedUser.name}</h3>
                                <p className="text-slate-500 font-mono text-sm">{selectedUser.email}</p>
                                {selectedUser.phone && (
                                    <p className="text-slate-600 font-mono text-xs mt-1">PHONE: {selectedUser.phone}</p>
                                )}
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="text-center p-3 bg-slate-800 rounded">
                                <Zap className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                                <div className="text-lg font-bold">{selectedUser.xp || 0}</div>
                                <div className="text-xs text-slate-500">XP</div>
                            </div>
                            <div className="text-center p-3 bg-slate-800 rounded">
                                <Trophy className="w-6 h-6 text-primary mx-auto mb-1" />
                                <div className="text-lg font-bold">{selectedUser.level || 1}</div>
                                <div className="text-xs text-slate-500">Level</div>
                            </div>
                            <div className="text-center p-3 bg-slate-800 rounded">
                                <Flame className="w-6 h-6 text-orange-500 mx-auto mb-1" />
                                <div className="text-lg font-bold">{selectedUser.streak?.count || 0}</div>
                                <div className="text-xs text-slate-500">Streak</div>
                            </div>
                            <div className="text-center p-3 bg-slate-800 rounded">
                                <BookOpen className="w-6 h-6 text-secondary mx-auto mb-1" />
                                <div className="text-lg font-bold">{selectedUser.completedSections?.length || 0}</div>
                                <div className="text-xs text-slate-500">Sections</div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h4 className="font-heading text-primary mb-3">ENROLLED COURSES ({selectedUser.unlockedCourses?.length || 0})</h4>
                            {selectedUser.unlockedCourses?.length > 0 ? (
                                <div className="space-y-2">
                                    {selectedUser.unlockedCourses.map((course, idx) => (
                                        <div key={course?._id || `${selectedUser._id}-unlock-${idx}`} className="flex justify-between items-center bg-slate-800 p-3 rounded">
                                            <span className="text-white">{course?.title || "Untitled course"}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">{course.isFree ? "FREE" : `${course.price} EGP`}</span>
                                                <button onClick={() => revokeAccess(selectedUser._id, course._id)} className="text-red-400 hover:text-red-300">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500 text-sm">No courses enrolled</p>
                            )}
                        </div>

                        <div className="mb-6">
                            <h4 className="font-heading text-secondary mb-3">COMPLETED COURSES ({selectedUser.completedCourses?.length || 0})</h4>
                            {selectedUser.completedCourses?.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {selectedUser.completedCourses.map((course, idx) => (
                                        <span key={course?._id || `${selectedUser._id}-completed-${idx}`} className="bg-secondary/20 text-secondary px-3 py-1 rounded text-sm">
                                            ✓ {course.title}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500 text-sm">No courses completed</p>
                            )}
                        </div>

                        <div className="mb-6">
                            <h4 className="font-heading text-primary mb-3">PLAYER CONTROL</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-slate-800/50 p-3 rounded">
                                    <label className="text-xs text-slate-400 font-mono">ADD XP</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-700 p-2 text-white mt-2"
                                        value={xpDelta}
                                        onChange={(e) => setXpDelta(Number(e.target.value))}
                                    />
                                    <GameButton size="sm" className="mt-2 w-full" onClick={() => updateUserStats(selectedUser._id, { xpDelta })}>
                                        APPLY
                                    </GameButton>
                                </div>
                                <div className="bg-slate-800/50 p-3 rounded">
                                    <label className="text-xs text-slate-400 font-mono">SET TOTAL XP</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-700 p-2 text-white mt-2"
                                        value={xpTotal}
                                        onChange={(e) => setXpTotal(Number(e.target.value))}
                                    />
                                    <GameButton size="sm" className="mt-2 w-full" onClick={() => updateUserStats(selectedUser._id, { xpTotal })}>
                                        APPLY
                                    </GameButton>
                                </div>
                                <div className="bg-slate-800/50 p-3 rounded">
                                    <label className="text-xs text-slate-400 font-mono">SET STREAK</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-700 p-2 text-white mt-2"
                                        value={streakCount}
                                        onChange={(e) => setStreakCount(Number(e.target.value))}
                                    />
                                    <GameButton size="sm" className="mt-2 w-full" onClick={() => updateUserStats(selectedUser._id, { streakCount })}>
                                        APPLY
                                    </GameButton>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="text-xs text-slate-600 font-mono">
                                Joined: {new Date(selectedUser.createdAt).toLocaleDateString()}
                            </div>
                            <GameButton size="sm" variant="ghost" onClick={() => handleDelete(selectedUser._id)} className="text-red-400 hover:text-red-300">
                                <Trash2 className="w-4 h-4" /> DELETE USER
                            </GameButton>
                        </div>
                    </GameCard>
                </div>
            )}

            {/* Grant Access Modal */}
            {showGrantModal && grantUserId && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <GameCard className="w-full max-w-md bg-slate-900">
                        <h3 className="text-xl font-heading text-white mb-4">GRANT COURSE ACCESS</h3>
                        <p className="text-slate-400 text-sm mb-4">Select a course to grant access:</p>

                        <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                            {courses.map(course => (
                                <button
                                    key={course._id}
                                    onClick={() => grantAccess(grantUserId, course._id)}
                                    className="w-full flex justify-between items-center bg-slate-800 hover:bg-slate-700 p-3 rounded text-left transition"
                                >
                                    <span className="text-white">{course.title}</span>
                                    <span className="text-xs text-slate-500">{course.isFree ? "FREE" : `${course.price} EGP`}</span>
                                </button>
                            ))}
                        </div>

                        <GameButton variant="ghost" className="w-full" onClick={() => setShowGrantModal(false)}>
                            CANCEL
                        </GameButton>
                    </GameCard>
                </div>
            )}
        </div>
    );
}
