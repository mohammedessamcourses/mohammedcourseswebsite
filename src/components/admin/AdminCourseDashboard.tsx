"use client";

import { useMemo, useState } from "react";
import { GameCard } from "@/components/ui/GameCard";
import { GameButton } from "@/components/ui/GameButton";
import { Users, CheckCircle, DollarSign, UserPlus, Trash2 } from "lucide-react";
import { getApprovedPaidAmount } from "@/lib/revenue";

interface Course {
    _id: string;
    title: string;
    price: number;
    isFree: boolean;
    discountPrice?: number;
    discountActive?: boolean;
}

interface RequestRecord {
    _id: string;
    status: string;
    courseId?: { _id: string; title: string; price: number; discountPrice?: number; discountActive?: boolean } | string;
    paymentDetails?: { amount?: number };
    createdAt: string;
}

interface UserData {
    _id: string;
    name: string;
    email: string;
    unlockedCourses?: Array<{ _id: string } | string>;
    completedCourses?: Array<{ _id: string } | string>;
}

interface AdminCourseDashboardProps {
    courses: Course[];
    users: UserData[];
    requests: RequestRecord[];
    onGrantAccess: (userId: string, courseId: string) => Promise<void>;
    onRevokeAccess: (userId: string, courseId: string) => Promise<void>;
}

const hasCourse = (list: Array<{ _id: string } | string | any> | undefined, courseId: string) => {
    if (!list?.length) return false;
    return list.some(item => {
        if (typeof item === "string") return item === courseId;
        if (item && typeof item === "object") {
            if (item._id) return String(item._id) === String(courseId);
            return String(item) === String(courseId);
        }
        return false;
    });
};

export function AdminCourseDashboard({ courses, users, requests, onGrantAccess, onRevokeAccess }: AdminCourseDashboardProps) {
    const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?._id || "");
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [busy, setBusy] = useState(false);

    const selectedCourse = courses.find(c => c._id === selectedCourseId);

    const usersWithAccess = useMemo(() => {
        if (!selectedCourseId) return [];
        if (selectedCourse?.isFree) return users;
        return users.filter(u =>
            hasCourse(u.unlockedCourses, selectedCourseId) || hasCourse(u.completedCourses, selectedCourseId)
        );
    }, [users, selectedCourseId, selectedCourse?.isFree]);

    const usersCompleted = useMemo(
        () => users.filter(u => hasCourse(u.completedCourses, selectedCourseId)),
        [users, selectedCourseId]
    );

    const courseRequests = useMemo(
        () =>
            requests.filter(r => {
                const courseId = typeof r.courseId === "string" ? r.courseId : r.courseId?._id;
                return courseId === selectedCourseId;
            }),
        [requests, selectedCourseId]
    );

    const approvedRevenue = useMemo(
        () =>
            courseRequests.reduce((acc, req) => {
                const course =
                    typeof req.courseId === "string"
                        ? courses.find(c => c._id === req.courseId)
                        : req.courseId || selectedCourse;

                return acc + getApprovedPaidAmount(req, course);
            }, 0),
        [courseRequests, courses, selectedCourse]
    );

    const pendingCount = courseRequests.filter(r => r.status === "pending").length;

    const completionRate = usersWithAccess.length
        ? Math.round((usersCompleted.length / usersWithAccess.length) * 100)
        : 0;

    const availableUsers = selectedCourse?.isFree
        ? []
        : users.filter(u =>
            !hasCourse(u.unlockedCourses, selectedCourseId) && !hasCourse(u.completedCourses, selectedCourseId)
        );

    const handleGrant = async () => {
        if (!selectedUserId || !selectedCourseId) return;
        setBusy(true);
        await onGrantAccess(selectedUserId, selectedCourseId);
        setSelectedUserId("");
        setBusy(false);
    };

    const handleRevoke = async (userId: string) => {
        if (!selectedCourseId) return;
        setBusy(true);
        await onRevokeAccess(userId, selectedCourseId);
        setBusy(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <label className="text-xs text-slate-500 font-mono">SELECT COURSE</label>
                <select
                    className="bg-slate-900 border border-slate-700 p-2 text-white w-full sm:max-w-md"
                    value={selectedCourseId}
                    onChange={e => setSelectedCourseId(e.target.value)}
                >
                    {courses.map(course => (
                        <option key={course._id} value={course._id}>{course.title}</option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <GameCard className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-500/20 rounded text-blue-400">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 font-mono">ACCESS GRANTED</div>
                            <div className="text-2xl font-bold text-white">{usersWithAccess.length}</div>
                        </div>
                    </div>
                </GameCard>
                <GameCard className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-500/20 rounded text-green-400">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 font-mono">COMPLETED</div>
                            <div className="text-2xl font-bold text-white">{usersCompleted.length}</div>
                        </div>
                    </div>
                </GameCard>
                <GameCard className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-500/20 rounded text-emerald-400">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 font-mono">APPROVED REVENUE</div>
                            <div className="text-2xl font-bold text-white">{approvedRevenue.toLocaleString()} EGP</div>
                        </div>
                    </div>
                </GameCard>
                <GameCard className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-yellow-500/20 rounded text-yellow-400">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 font-mono">PENDING REQUESTS</div>
                            <div className="text-2xl font-bold text-white">{pendingCount}</div>
                        </div>
                    </div>
                </GameCard>
            </div>

            <GameCard className="p-4">
                <div className="text-xs text-slate-500 font-mono mb-2">OVERALL PROGRESS</div>
                <div className="w-full h-3 bg-slate-800 rounded overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${completionRate}%` }} />
                </div>
                <div className="text-xs text-slate-500 mt-2">{completionRate}% completion rate</div>
            </GameCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GameCard className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-heading text-white">ADD USER TO COURSE</h3>
                        <UserPlus className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <select
                            className="bg-slate-900 border border-slate-700 p-2 text-white w-full"
                            value={selectedUserId}
                            onChange={e => setSelectedUserId(e.target.value)}
                        >
                            <option value="">Select user...</option>
                            {availableUsers.map(user => (
                                <option key={user._id} value={user._id}>{user.name} - {user.email}</option>
                            ))}
                        </select>
                        <GameButton onClick={handleGrant} disabled={busy || !selectedUserId}>
                            ADD
                        </GameButton>
                    </div>
                </GameCard>

                <GameCard className="p-4">
                    <h3 className="text-lg font-heading text-white mb-3">USERS WITH ACCESS</h3>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                        {usersWithAccess.map(user => (
                            <div key={user._id} className="flex items-center justify-between bg-slate-800 p-3 rounded">
                                <div>
                                    <div className="text-white text-sm font-bold">{user.name}</div>
                                    <div className="text-xs text-slate-500 font-mono">{user.email}</div>
                                </div>
                                <button
                                    onClick={() => handleRevoke(user._id)}
                                    className="text-red-400 hover:text-red-300"
                                    aria-label="Remove access"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {usersWithAccess.length === 0 && (
                            <div className="text-slate-500 text-sm">No users have access.</div>
                        )}
                    </div>
                </GameCard>
            </div>

            {!selectedCourse && (
                <div className="text-slate-500 font-mono text-sm">Select a course to view stats.</div>
            )}
        </div>
    );
}
