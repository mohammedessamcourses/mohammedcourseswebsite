"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { GameButton } from "@/components/ui/GameButton";
import { GameInput } from "@/components/ui/GameInput";

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (res.ok) {
                if (data.user.role === "admin") {
                    router.push("/admin");
                } else {
                    router.push("/");
                }
            } else {
                setError(data.error || "Login failed");
            }
        } catch (err) {
            setError("An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
            <div className="w-full max-w-md bg-slate-900 border-2 border-slate-700 p-8 relative">
                {/* Decorative Top Bar */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-arcade" />

                <h2 className="text-3xl font-heading text-white mb-8 text-center text-shadow-sm">System Login</h2>

                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 mb-6 text-sm font-mono text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <GameInput
                        label="Player Email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                    <div className="relative">
                        <GameInput
                            label="Password"
                            type={showPassword ? "text" : "password"}
                            required
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-[38px] text-slate-400 hover:text-white transition-colors"
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>

                    <GameButton
                        className="w-full mt-4 !tracking-normal !text-sm sm:!text-lg leading-tight"
                        size="lg"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <span className="sm:hidden">AUTH...</span>
                                <span className="hidden sm:inline">AUTHENTICATING...</span>
                            </>
                        ) : (
                            "ENTER WORLD"
                        )}
                    </GameButton>
                </form>

                <p className="mt-6 text-center text-slate-500 font-mono text-sm">
                    New Player?{" "}
                    <Link href="/register" className="text-primary hover:underline">
                        Create Character
                    </Link>
                </p>

                <div className="mt-8 text-center">
                    <Link
                        href="/"
                        className="text-sm text-slate-500 hover:text-white transition-colors inline-flex items-center gap-2 font-mono group"
                    >
                        <span className="group-hover:-translate-x-1 transition-transform">←</span> Return to Main Menu
                    </Link>
                </div>
            </div>
        </main>
    );
}
