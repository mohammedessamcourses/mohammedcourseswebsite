"use client";

import { useState } from "react";
import Link from "next/link";
import { GameButton } from "@/components/ui/GameButton";
import { GameInput } from "@/components/ui/GameInput";

export default function RegisterPage() {
    const [formData, setFormData] = useState({ name: "", email: "", phone: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, role: "student" }),
            });

            const data = await res.json();

            if (res.ok) {
                // Full-document navigation so the new session cookie is applied
                // and the logged-out App Router cache is discarded (see login page).
                window.location.href = "/";
                return;
            } else {
                setError(data.error || "Registration failed");
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
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-arcade via-purple-500 to-primary" />

                <h2 className="text-3xl font-heading text-white mb-8 text-center text-shadow-sm">New Character</h2>

                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 mb-6 text-sm font-mono text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <GameInput
                        label="Character Name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                    <GameInput
                        label="Email Address"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                    <GameInput
                        label="Phone Number"
                        type="tel"
                        required
                        value={formData.phone}
                        placeholder="e.g. 01012345678"
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                    <GameInput
                        label="Secret Key (Password)"
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />

                    <GameButton
                        className="w-full mt-4"
                        size="lg"
                        variant="secondary"
                        disabled={loading}
                    >
                        {loading ? "CREATING..." : "START ADVENTURE"}
                    </GameButton>
                </form>

                <p className="mt-6 text-center text-slate-500 font-mono text-sm">
                    Already have an account?{" "}
                    <Link href="/login" className="text-secondary hover:underline">
                        Resume Game
                    </Link>
                </p>
            </div>
        </main>
    );
}
