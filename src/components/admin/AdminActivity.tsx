"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    Activity,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Search,
    TrendingUp,
    Users,
    Zap,
} from "lucide-react";
import { ACTIVITY_TYPES, getActivityMeta } from "@/lib/activity-types";

interface ActivityLogRow {
    _id: string;
    type: string;
    description: string;
    userName?: string;
    userEmail?: string;
    metadata?: Record<string, unknown>;
    ip?: string;
    createdAt: string;
}

interface StatsResponse {
    timezone: string;
    rangeDays: number;
    totals: {
        dau: number;
        wau: number;
        mau: number;
        eventsToday: number;
        rangeEvents: number;
        totalEvents: number;
        totalUsers: number;
        newUsersToday: number;
        stickiness: number;
    };
    series: Array<{ date: string; events: number; activeUsers: number }>;
    byType: Array<{ type: string; label: string; category: string; count: number }>;
    topUsers: Array<{ userId: string; name: string; email: string; events: number; lastSeen: string }>;
}

const PAGE_SIZE = 25;
const REFRESH_MS = 30000;

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
}

function StatTile({
    label,
    value,
    hint,
    icon: Icon,
    accent,
}: {
    label: string;
    value: string | number;
    hint?: string;
    icon: React.ElementType;
    accent: string;
}) {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded p-5 relative overflow-hidden">
            <div className={`absolute top-0 left-0 h-1 w-full ${accent}`} />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500 mb-2">{label}</p>
                    <p className="text-3xl font-heading text-white leading-none">{value}</p>
                    {hint && <p className="text-[11px] font-mono text-slate-500 mt-2">{hint}</p>}
                </div>
                <Icon className="w-5 h-5 text-slate-600 shrink-0" />
            </div>
        </div>
    );
}

export function AdminActivity() {
    const [stats, setStats] = useState<StatsResponse | null>(null);
    const [logs, setLogs] = useState<ActivityLogRow[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);

    const [typeFilter, setTypeFilter] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [rangeDays, setRangeDays] = useState(30);

    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [error, setError] = useState("");
    const [mounted, setMounted] = useState(false);

    const didMount = useRef(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Debounce the search box so typing doesn't fire a request per keystroke.
    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput);
            setPage(0);
        }, 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/activity/stats?days=${rangeDays}`, { cache: "no-store" });
            if (!res.ok) {
                setError(res.status === 401 || res.status === 403 ? "Not authorised." : "Failed to load stats.");
                return;
            }
            setStats(await res.json());
            setError("");
        } catch {
            setError("Failed to load stats.");
        } finally {
            setLoadingStats(false);
        }
    }, [rangeDays]);

    const fetchLogs = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                limit: String(PAGE_SIZE),
                offset: String(page * PAGE_SIZE),
            });
            if (typeFilter) params.set("type", typeFilter);
            if (search) params.set("search", search);

            const res = await fetch(`/api/admin/activity?${params.toString()}`, { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            setLogs(data.logs || []);
            setTotalCount(data.totalCount || 0);
        } catch {
            /* keep previous page on transient failure */
        } finally {
            setLoadingLogs(false);
        }
    }, [page, typeFilter, search]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        if (!autoRefresh) return;
        const id = setInterval(() => {
            fetchStats();
            fetchLogs();
        }, REFRESH_MS);
        return () => clearInterval(id);
    }, [autoRefresh, fetchStats, fetchLogs]);

    useEffect(() => {
        didMount.current = true;
    }, []);

    const chartData = useMemo(
        () =>
            (stats?.series || []).map((d) => ({
                ...d,
                label: new Date(`${d.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            })),
        [stats]
    );

    const typeOptions = useMemo(() => Object.keys(ACTIVITY_TYPES), []);
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    const handleManualRefresh = () => {
        setLoadingStats(true);
        setLoadingLogs(true);
        fetchStats();
        fetchLogs();
    };

    if (error) {
        return (
            <div className="bg-slate-900 border border-red-500/40 rounded p-8 text-center">
                <p className="font-mono text-red-400">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                    <CalendarDays className="w-4 h-4 text-slate-500" />
                    {[7, 14, 30, 90].map((d) => (
                        <button
                            key={d}
                            onClick={() => setRangeDays(d)}
                            className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
                                rangeDays === d
                                    ? "bg-primary/20 text-primary border-primary/50"
                                    : "bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500"
                            }`}
                        >
                            {d}D
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-2 text-xs font-mono text-slate-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        Auto-refresh (30s)
                    </label>
                    <button
                        onClick={handleManualRefresh}
                        className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono bg-slate-900 border border-slate-700 text-slate-300 hover:border-primary/50 hover:text-primary transition-colors"
                    >
                        <RefreshCw className={`w-3 h-3 ${loadingStats ? "animate-spin" : ""}`} />
                        REFRESH
                    </button>
                </div>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatTile
                    label="Daily Active Users"
                    value={loadingStats ? "—" : stats?.totals.dau ?? 0}
                    hint={`Today · ${stats?.timezone || ""}`}
                    icon={Zap}
                    accent="bg-primary"
                />
                <StatTile
                    label="Weekly Active Users"
                    value={loadingStats ? "—" : stats?.totals.wau ?? 0}
                    hint="Unique users, last 7 days"
                    icon={Users}
                    accent="bg-cyan-500"
                />
                <StatTile
                    label="Monthly Active Users"
                    value={loadingStats ? "—" : stats?.totals.mau ?? 0}
                    hint={`of ${stats?.totals.totalUsers ?? 0} registered`}
                    icon={TrendingUp}
                    accent="bg-yellow-500"
                />
                <StatTile
                    label="Events Today"
                    value={loadingStats ? "—" : stats?.totals.eventsToday ?? 0}
                    hint={`${stats?.totals.totalEvents ?? 0} logged all-time`}
                    icon={Activity}
                    accent="bg-purple-500"
                />
            </div>

            {/* Secondary metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "New users today", value: stats?.totals.newUsersToday ?? 0 },
                    { label: "Stickiness (DAU/MAU)", value: `${stats?.totals.stickiness ?? 0}%` },
                    { label: `Events in ${rangeDays}d`, value: stats?.totals.rangeEvents ?? 0 },
                    { label: "Total users", value: stats?.totals.totalUsers ?? 0 },
                ].map((m) => (
                    <div key={m.label} className="bg-slate-900/60 border border-slate-800 rounded px-4 py-3">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{m.label}</p>
                        <p className="text-lg font-mono text-white mt-1">{loadingStats ? "—" : m.value}</p>
                    </div>
                ))}
            </div>

            {/* Trend chart */}
            <div className="bg-slate-900 border border-slate-800 rounded p-6">
                <h3 className="text-lg font-heading text-slate-300 mb-6">
                    ACTIVITY TREND ({rangeDays} DAYS)
                </h3>
                <div className="h-[320px] w-full">
                    {!mounted || loadingStats ? (
                        <div className="h-full w-full bg-slate-800/30 rounded animate-pulse" />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="eventsFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.5} />
                                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} minTickGap={20} />
                                <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#fff" }}
                                    labelStyle={{ color: "#94a3b8" }}
                                />
                                <Legend wrapperStyle={{ fontSize: 12, fontFamily: "monospace" }} />
                                <Area
                                    type="monotone"
                                    dataKey="events"
                                    name="Events"
                                    stroke="#a855f7"
                                    strokeWidth={2}
                                    fill="url(#eventsFill)"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="activeUsers"
                                    name="Active users"
                                    stroke="#22c55e"
                                    strokeWidth={3}
                                    dot={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Breakdown + top users */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded p-6">
                    <h3 className="text-lg font-heading text-slate-300 mb-6">ACTIVITY BY TYPE ({rangeDays}D)</h3>
                    <div className="h-[300px] w-full">
                        {!mounted || loadingStats ? (
                            <div className="h-full w-full bg-slate-800/30 rounded animate-pulse" />
                        ) : (stats?.byType.length || 0) > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats?.byType} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis type="number" stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                                    <YAxis
                                        dataKey="label"
                                        type="category"
                                        width={140}
                                        stroke="#94a3b8"
                                        fontSize={11}
                                    />
                                    <Tooltip
                                        cursor={{ fill: "rgba(255,255,255,0.05)" }}
                                        contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#fff" }}
                                    />
                                    <Bar dataKey="count" name="Events" fill="#22c55e" radius={[0, 4, 4, 0]} barSize={16} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-600 font-mono text-sm">
                                No activity recorded yet.
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded p-6">
                    <h3 className="text-lg font-heading text-slate-300 mb-6">MOST ACTIVE USERS ({rangeDays}D)</h3>
                    <div className="space-y-2">
                        {loadingStats ? (
                            <div className="h-40 bg-slate-800/30 rounded animate-pulse" />
                        ) : (stats?.topUsers.length || 0) === 0 ? (
                            <p className="text-slate-600 font-mono text-sm py-12 text-center">No user activity yet.</p>
                        ) : (
                            stats?.topUsers.map((u, i) => (
                                <div
                                    key={u.userId}
                                    className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded px-3 py-2"
                                >
                                    <span className="font-mono text-xs text-slate-600 w-5">#{i + 1}</span>
                                    <div className="min-w-0 flex-grow">
                                        <p className="text-sm text-white truncate">{u.name}</p>
                                        <p className="text-[11px] font-mono text-slate-500 truncate">{u.email}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-mono text-sm text-primary">{u.events}</p>
                                        <p className="text-[10px] font-mono text-slate-600">{timeAgo(u.lastSeen)}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Live log feed */}
            <div className="bg-slate-900 border border-slate-800 rounded p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                    <h3 className="text-lg font-heading text-slate-300">
                        ACTIVITY LOG <span className="text-slate-600 text-sm font-mono">({totalCount})</span>
                    </h3>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Search name, email, action..."
                                className="bg-slate-950 border border-slate-700 rounded pl-9 pr-3 py-2 text-sm text-white w-full sm:w-64 font-mono focus:border-primary/50 outline-none"
                            />
                        </div>
                        <select
                            value={typeFilter}
                            onChange={(e) => {
                                setTypeFilter(e.target.value);
                                setPage(0);
                            }}
                            className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:border-primary/50 outline-none"
                        >
                            <option value="">All activity types</option>
                            {typeOptions.map((t) => (
                                <option key={t} value={t}>
                                    {getActivityMeta(t).label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                        <thead>
                            <tr className="text-left border-b border-slate-800">
                                <th className="pb-3 font-mono text-[11px] uppercase tracking-wider text-slate-500">Type</th>
                                <th className="pb-3 font-mono text-[11px] uppercase tracking-wider text-slate-500">Activity</th>
                                <th className="pb-3 font-mono text-[11px] uppercase tracking-wider text-slate-500">User</th>
                                <th className="pb-3 font-mono text-[11px] uppercase tracking-wider text-slate-500 text-right">When</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingLogs ? (
                                [...Array(6)].map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan={4} className="py-2">
                                            <div className="h-8 bg-slate-800/30 rounded animate-pulse" />
                                        </td>
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-16 text-center text-slate-600 font-mono">
                                        No activity matches these filters.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => {
                                    const meta = getActivityMeta(log.type);
                                    return (
                                        <tr
                                            key={log._id}
                                            className="border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors"
                                        >
                                            <td className="py-3 pr-4 align-top">
                                                <span
                                                    className={`inline-block whitespace-nowrap text-[10px] font-mono px-2 py-1 rounded border ${meta.color}`}
                                                >
                                                    {meta.label}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 text-slate-300 align-top">{log.description}</td>
                                            <td className="py-3 pr-4 align-top">
                                                {log.userName ? (
                                                    <div className="min-w-0">
                                                        <p className="text-slate-300 truncate">{log.userName}</p>
                                                        {log.userEmail && (
                                                            <p className="text-[11px] font-mono text-slate-500 truncate">
                                                                {log.userEmail}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-600 font-mono text-xs">anonymous</span>
                                                )}
                                            </td>
                                            <td className="py-3 text-right align-top whitespace-nowrap">
                                                <p className="font-mono text-xs text-slate-400">{timeAgo(log.createdAt)}</p>
                                                <p className="font-mono text-[10px] text-slate-600">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </p>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {totalCount > PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
                        <p className="font-mono text-xs text-slate-500">
                            Page {page + 1} of {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono bg-slate-950 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-500"
                            >
                                <ChevronLeft className="w-3 h-3" /> PREV
                            </button>
                            <button
                                onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
                                disabled={page + 1 >= totalPages}
                                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono bg-slate-950 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-500"
                            >
                                NEXT <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
