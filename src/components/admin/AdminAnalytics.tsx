
"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

interface AdminAnalyticsProps {
    users: any[];
    requests: any[];
}

export function AdminAnalytics({ users, requests }: AdminAnalyticsProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Process User Growth Data (Last 7 Days)
    const processUserGrowth = () => {
        const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        return last7Days.map(date => {
            return {
                date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
                users: users.filter(u => u.createdAt && u.createdAt.startsWith(date)).length
            };
        });
    };

    // Process Revenue Data (from Requests)
    const processRevenue = () => {
        // Group by course title
        const revenueMap: Record<string, number> = {};

        requests.forEach(req => {
            // Count potential revenue from all requests (Pending + Approved) to show demand
            if (req.courseId && req.courseId.title) {
                revenueMap[req.courseId.title] = (revenueMap[req.courseId.title] || 0) + (req.courseId.price || 0);
            }
        });

        return Object.keys(revenueMap).map(course => ({
            name: course.length > 15 ? course.substring(0, 15) + '...' : course,
            revenue: revenueMap[course],
            fullTitle: course
        }));
    };

    const userData = processUserGrowth();
    const revenueData = processRevenue();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 animate-fade-in-up">
            {/* User Growth Chart */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded shadow-lg">
                <h3 className="text-lg font-heading text-slate-300 mb-6">USER ACQUISITION (7 DAYS)</h3>
                <div className="h-[300px] w-full">
                    {mounted ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={userData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                                <YAxis stroke="#94a3b8" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                                    itemStyle={{ color: '#3b82f6' }}
                                />
                                <Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full w-full bg-slate-800/30 rounded animate-pulse" />
                    )}
                </div>
            </div>

            {/* Revenue Potential Chart */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded shadow-lg">
                <h3 className="text-lg font-heading text-slate-300 mb-6">REVENUE DEMAND (BY MISSION)</h3>
                <div className="h-[300px] w-full">
                    {!mounted ? (
                        <div className="h-full w-full bg-slate-800/30 rounded animate-pulse" />
                    ) : revenueData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                                <YAxis dataKey="name" type="category" width={100} stroke="#94a3b8" fontSize={12} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                                />
                                <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-600 font-mono">
                            No financial data available.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
