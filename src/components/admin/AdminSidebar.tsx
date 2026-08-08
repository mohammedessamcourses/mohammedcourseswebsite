
"use client";

import { LayoutDashboard, CreditCard, Award, BookOpen, Users, Mail, BarChart3, Activity } from "lucide-react";

interface AdminSidebarProps {
    currentView: string;
    setCurrentView: (view: string) => void;
}

export function AdminSidebar({ currentView, setCurrentView }: AdminSidebarProps) {
    const menuItems = [
        { id: "overview", label: "OVERVIEW", icon: LayoutDashboard },
        { id: "course-dashboard", label: "COURSE DASHBOARD", icon: BarChart3 },
        { id: "activity", label: "LOGS & ACTIVITY", icon: Activity },
        { id: "requests", label: "PAYMENT REQUESTS", icon: CreditCard },
        { id: "messages", label: "CONTACT MESSAGES", icon: Mail },
        { id: "certificates", label: "CERTIFICATES", icon: Award },
        { id: "courses", label: "MANAGE COURSES", icon: BookOpen },
        { id: "users", label: "USERS DATABASE", icon: Users },
    ];

    return (
        <aside className="w-full lg:w-64 bg-slate-900 border-r border-slate-800 p-4 shrink-0 h-full lg:min-h-screen">
            <div className="mb-8 px-4">
                <h2 className="text-xl font-heading text-red-500 text-shadow">ADMIN<br />CONSOLE</h2>
            </div>

            <nav className="space-y-2">
                {menuItems.map((item) => {
                    const isActive = currentView === item.id;
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.id}
                            onClick={() => setCurrentView(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded text-sm font-mono transition-all
                                ${isActive
                                    ? "bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                }
                            `}
                        >
                            <Icon className="w-4 h-4" />
                            {item.label}
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
}
