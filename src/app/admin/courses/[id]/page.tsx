"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { GameButton } from "@/components/ui/GameButton";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ArrowLeft, ChevronUp, ChevronDown, Edit, Trash2, Save, Plus, X, FileUp } from "lucide-react";

interface Question {
    questionText: string;
    options: string[];
    correctOptionIndex: number;
}

interface Section {
    _id: string;
    title: string;
    type: string;
    content?: string;
    videoUrl?: string;
    linkUrl?: string;
    isFree: boolean;
    questions?: Question[];
}

interface Course {
    _id: string;
    title: string;
    difficulty: string;
    description: string;
    price: number;
    discountPrice?: number;
    discountActive: boolean;
    certificateEnabled?: boolean;
    isFree: boolean;
    isFeatured: boolean;
    thumbnail: string;
    languages: string[];
    sections: Section[];
}

const parseCsvLine = (line: string) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    result.push(current.trim());
    return result;
};

const parseQuizCsv = (csvText: string) => {
    const rows = csvText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (rows.length === 0) return [] as Question[];

    const header = parseCsvLine(rows[0]).map(h => h.toLowerCase());
    const hasHeader = header.some(h => h.includes("question") || h.includes("option") || h.includes("correct"));
    const startIndex = hasHeader ? 1 : 0;

    const questions: Question[] = [];

    for (let i = startIndex; i < rows.length; i++) {
        const cols = parseCsvLine(rows[i]);
        if (cols.length < 3) continue;

        const questionText = cols[0]?.trim();
        const options = cols.slice(1, cols.length - 1).map(opt => opt.trim()).filter(Boolean);
        const rawCorrect = cols[cols.length - 1]?.trim();
        let correctOptionIndex = Number(rawCorrect);

        if (Number.isNaN(correctOptionIndex)) {
            correctOptionIndex = 1;
        }

        if (correctOptionIndex < 1 || correctOptionIndex > options.length) {
            correctOptionIndex = 1;
        }

        correctOptionIndex = correctOptionIndex - 1;

        if (!questionText || options.length < 2) continue;

        if (correctOptionIndex < 0 || correctOptionIndex >= options.length) {
            correctOptionIndex = 0;
        }

        questions.push({ questionText, options, correctOptionIndex });
    }

    return questions;
};

const isValidObjectId = (value: string) => /^[0-9a-fA-F]{24}$/.test(String(value || ""));

export default function EditCoursePage() {
    const params = useParams();
    const router = useRouter();
    const courseId = params?.id as string;

    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Add Section State
    const [newSection, setNewSection] = useState({ title: "", content: "", type: "text", videoUrl: "", linkUrl: "", isFree: false });

    // Edit Section State
    const [editingSection, setEditingSection] = useState<Section | null>(null);
    const [editForm, setEditForm] = useState<{
        title: string;
        content: string;
        videoUrl: string;
        linkUrl: string;
        type: string;
        isFree: boolean;
        questions: Question[];
    }>({ title: "", content: "", videoUrl: "", linkUrl: "", type: "text", isFree: false, questions: [] });

    const [csvImportError, setCsvImportError] = useState("");

    // Language Input Buffer
    const [languageInput, setLanguageInput] = useState("");

    useEffect(() => {
        if (courseId) {
            fetchCourse();
        }
    }, [courseId]);

    useEffect(() => {
        if (course) {
            setLanguageInput(course.languages?.join(", ") || "");
        }
    }, [course]);

    const fetchCourse = async () => {
        try {
            const resSingle = await fetch(`/api/courses/${courseId}?adminView=1&t=${Date.now()}`, { cache: "no-store" });
            if (!resSingle.ok) {
                setCourse(null);
                setLoading(false);
                return;
            }

            const json = await resSingle.json();
            if (json?.course) {
                const normalizedSections = (json.course.sections || []).map((section: any) => ({
                    ...section,
                    _id: section?._id ? String(section._id) : "",
                }));
                setCourse({
                    ...json.course,
                    sections: normalizedSections,
                    certificateEnabled: json.course.certificateEnabled === false ? false : true,
                });
            }

            setLoading(false);
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    const handleUpdateCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!course) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/courses/${courseId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: course.title,
                    description: course.description,
                    price: course.isFree ? 0 : course.price,
                    isFree: course.isFree,
                    isFeatured: course.isFeatured,
                    certificateEnabled: course.certificateEnabled === false ? false : true,
                    difficulty: course.difficulty,
                    thumbnail: course.thumbnail,
                    discountPrice: course.discountPrice,
                    discountActive: course.discountActive,

                    languages: languageInput.split(",").map(s => s.trim()).filter(Boolean)
                }),
            });
            const data = await res.json();
            if (res.ok) {
                if (data?.course) {
                    const normalizedSections = (data.course.sections || []).map((section: any) => ({
                        ...section,
                        _id: section?._id ? String(section._id) : "",
                    }));
                    setCourse({
                        ...data.course,
                        sections: normalizedSections,
                        certificateEnabled: data.course.certificateEnabled === false ? false : true,
                    });
                }
                await fetchCourse();
                alert("Course Updated Successfully!");
            } else {
                const expected = data?.expectedCertificateEnabled;
                const actual = data?.actualCertificateEnabled;
                if (typeof expected === "boolean" && typeof actual === "boolean") {
                    alert(`${data?.error || "Update Failed"} (expected: ${expected ? "ON" : "OFF"}, saved: ${actual ? "ON" : "OFF"})`);
                } else {
                    alert(data?.error || "Update Failed");
                }
            }
        } catch (e) { console.error(e); alert("Error updating course"); }
        setSaving(false);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !course) return;

        setUploadingImage(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            const data = await res.json();
            if (!res.ok) {
                alert(data?.error || "Upload failed");
                return;
            }

            const nextThumbnail = data.url;
            setCourse(prev => prev ? { ...prev, thumbnail: nextThumbnail } : prev);

            const persistRes = await fetch(`/api/courses/${courseId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ thumbnail: nextThumbnail }),
            });
            const persistData = await persistRes.json();

            if (!persistRes.ok) {
                alert(persistData?.error || "Image uploaded but course update failed");
                return;
            }

            if (persistData?.course?.thumbnail) {
                setCourse(prev => prev ? { ...prev, thumbnail: persistData.course.thumbnail } : prev);
            }
        } catch (err) {
            console.error(err);
            alert("Upload failed");
        } finally {
            setUploadingImage(false);
            e.target.value = "";
        }
    };

    const handleQuizCsvImport = async (file?: File) => {
        if (!file) return;
        setCsvImportError("");

        try {
            const text = await file.text();
            const parsed = parseQuizCsv(text);

            if (!parsed.length) {
                setCsvImportError("No valid questions found. Expected columns: question, options..., correctIndex.");
                return;
            }

            setEditForm({ ...editForm, questions: parsed });
        } catch (err) {
            console.error(err);
            setCsvImportError("Failed to import CSV.");
        }
    };

    const handleAddSection = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/courses/${courseId}/sections`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newSection)
            });

            if (res.ok) {
                alert("Section Added!");
                setNewSection({ title: "", content: "", type: "text", videoUrl: "", linkUrl: "", isFree: false });
                fetchCourse(); // Refresh
            } else {
                alert("Failed to add section");
            }
        } catch (e) { console.error(e); }
    };

    const handleReorderSection = async (idx: number, direction: 'up' | 'down') => {
        if (!course) return;
        if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === course.sections.length - 1)) return;

        const newSections = [...course.sections];
        const sectionToMove = newSections[idx];
        newSections.splice(idx, 1);
        newSections.splice(direction === 'up' ? idx - 1 : idx + 1, 0, sectionToMove);

        // Optimistic
        setCourse({ ...course, sections: newSections });

        try {
            const sectionIds = newSections
                .map((s) => s._id)
                .filter((sectionId: string) => isValidObjectId(sectionId));

            if (sectionIds.length !== newSections.length) {
                alert("Some sections have invalid IDs. Refreshing course data.");
                fetchCourse();
                return;
            }

            await fetch(`/api/courses/${course._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sections: sectionIds }),
            });
        } catch (e) { fetchCourse(); }
    };

    const handleDeleteSection = async (sectionId: string) => {
        if (!isValidObjectId(sectionId)) {
            alert("Invalid section ID. Refreshing course data.");
            fetchCourse();
            return;
        }
        if (!confirm("Delete this section permanently?")) return;
        try {
            await fetch(`/api/sections/${sectionId}`, { method: "DELETE" });
            fetchCourse();
        } catch (e) { console.error(e); }
    };

    /* Edit Section Logic */
    const openEditSection = (section: Section) => {
        if (!isValidObjectId(section._id)) {
            alert("Invalid section ID. Refreshing course data.");
            fetchCourse();
            return;
        }
        setEditingSection(section);
        setEditForm({
            title: section.title,
            content: section.content || "",
            videoUrl: section.videoUrl || "",
            linkUrl: section.linkUrl || "",
            type: section.type || "text",
            isFree: section.isFree,
            questions: section.questions || []
        });
    };

    const handleUpdateSection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSection) return;
        try {
            const res = await fetch(`/api/sections/${editingSection._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editForm),
            });
            if (res.ok) {
                alert("Section updated!");
                setEditingSection(null);
                fetchCourse();
            }
        } catch (e) { alert("Failed to update section"); }
    };

    if (loading) return <div className="bg-slate-950 min-h-screen text-white flex items-center justify-center">Loading Course Data...</div>;
    if (!course) return <div className="bg-slate-950 min-h-screen text-white flex items-center justify-center">Course Not Found</div>;

    return (
        <main className="min-h-screen bg-slate-950 text-white flex flex-col lg:flex-row">
            {/* Reuse Sidebar for Visual Consistency, though navigation might act purely as links */}
            <AdminSidebar currentView="courses" setCurrentView={(view) => { if (view !== 'courses') router.push('/admin'); }} />

            <div className="flex-1 p-6 lg:p-10 overflow-y-auto max-h-screen">
                <header className="flex items-center gap-4 mb-8 pb-4 border-b border-slate-800">
                    <GameButton variant="ghost" size="sm" onClick={() => router.push('/admin')}>
                        <ArrowLeft className="w-5 h-5" /> BACK
                    </GameButton>
                    <div>
                        <h1 className="text-2xl font-heading text-primary">EDITING: {course.title}</h1>
                        <p className="text-slate-500 font-mono text-xs uppercase">ID: {course._id}</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* LEFT COLUMN: Course Details */}
                    <div className="xl:col-span-1 space-y-6">
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Edit className="w-4 h-4 text-primary" /> COURSE DETAILS
                            </h3>
                            <form onSubmit={handleUpdateCourse} className="space-y-4">
                                <div>
                                    <label className="text-xs text-slate-500 font-mono mb-1 block">TITLE</label>
                                    <input className="w-full bg-slate-950 border border-slate-700 p-2 text-white" value={course.title} onChange={e => setCourse({ ...course, title: e.target.value })} required />
                                </div>

                                <div>
                                    <label className="text-xs text-slate-500 font-mono mb-1 block">DIFFICULTY</label>
                                    <select className="w-full bg-slate-950 border border-slate-700 p-2 text-white" value={course.difficulty} onChange={e => setCourse({ ...course, difficulty: e.target.value })}>
                                        <option value="beginner">Beginner</option>
                                        <option value="intermediate">Intermediate</option>
                                        <option value="advanced">Advanced</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs text-slate-500 font-mono mb-1 block">LANGUAGES (Comma Separated)</label>
                                    <input
                                        className="w-full bg-slate-950 border border-slate-700 p-2 text-white"
                                        placeholder="e.g. JavaScript, React, Node.js"
                                        value={languageInput}
                                        onChange={e => setLanguageInput(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-slate-500 font-mono mb-1 block">DESCRIPTION</label>
                                    <textarea className="w-full bg-slate-950 border border-slate-700 p-2 text-white h-32" value={course.description} onChange={e => setCourse({ ...course, description: e.target.value })} required />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-slate-500 font-mono mb-1 block">PRICE (EGP)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-950 border border-slate-700 p-2 text-white disabled:opacity-50"
                                            value={course.isFree ? 0 : course.price}
                                            onChange={e => setCourse({ ...course, price: Number(e.target.value) })}
                                            disabled={course.isFree}
                                        />
                                    </div>
                                    <div className="flex flex-col justify-end">
                                        <label className="flex items-center gap-2 text-white cursor-pointer p-2 border border-slate-700 rounded bg-slate-950 hover:bg-slate-800">
                                            <input type="checkbox" checked={course.isFree} onChange={e => setCourse({ ...course, isFree: e.target.checked, price: e.target.checked ? 0 : course.price })} />
                                            <span className="text-sm">Free Access</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Discount Section */}
                                <div className="border border-slate-700 bg-slate-950/50 p-4 rounded space-y-3">
                                    <label className="flex items-center gap-2 text-white cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={course.discountActive || false}
                                            onChange={e => setCourse({ ...course, discountActive: e.target.checked })}
                                            disabled={course.isFree}
                                        />
                                        <span className="text-sm text-yellow-400 font-bold">🏷️ Enable Discount</span>
                                    </label>
                                    {course.discountActive && !course.isFree && (
                                        <div>
                                            <label className="text-xs text-slate-500 font-mono mb-1 block">DISCOUNT PRICE (EGP)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-slate-950 border border-yellow-500/50 p-2 text-yellow-400"
                                                placeholder="Sale price..."
                                                value={course.discountPrice || ""}
                                                onChange={e => setCourse({ ...course, discountPrice: Number(e.target.value) || undefined })}
                                            />
                                            <p className="text-xs text-slate-500 mt-1">
                                                Original: {course.price} EGP → Sale: {course.discountPrice || 0} EGP
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs text-slate-500 font-mono mb-1 block">THUMBNAIL</label>
                                    <div className="flex items-center gap-2">
                                        <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} className="text-xs text-slate-400" />
                                        {uploadingImage && <span className="text-xs text-primary">Uploading...</span>}
                                        {course.thumbnail && <img src={course.thumbnail} alt="Thumb" className="w-10 h-10 object-cover rounded border border-slate-700" />}
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 text-white cursor-pointer">
                                    <input type="checkbox" checked={course.isFeatured} onChange={e => setCourse({ ...course, isFeatured: e.target.checked })} />
                                    <span className="text-sm">Featured Course</span>
                                </label>

                                <label className="flex items-center gap-2 text-white cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={course.certificateEnabled !== false}
                                        onChange={e => setCourse({ ...course, certificateEnabled: e.target.checked })}
                                    />
                                    <span className="text-sm">Certificate Enabled</span>
                                </label>

                                <div className="text-xs font-mono text-slate-400">
                                    Persisted Certificate State: <span className={course.certificateEnabled === false ? "text-red-400" : "text-primary"}>{course.certificateEnabled === false ? "OFF" : "ON"}</span>
                                </div>

                                <GameButton type="submit" disabled={saving} className="w-full">
                                    {saving ? "SAVING..." : "SAVE CHANGES"}
                                </GameButton>
                            </form>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Section Management */}
                    <div className="xl:col-span-2 space-y-6">
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center justify-between">
                                <span className="flex items-center gap-2"><ArrowLeft className="w-4 h-4 rotate-180 text-secondary" /> CURRICULUM ({course.sections.length})</span>
                                <span className="text-xs font-mono text-slate-500">DRAG & DROP ENABLED (Sort Buttons)</span>
                            </h3>

                            <div className="space-y-2 mb-8">
                                {course.sections.map((section, idx) => (
                                    <div key={`${section?._id || "section"}-${idx}`} className="bg-slate-950 border border-slate-800 p-4 flex justify-between items-center rounded group hover:border-slate-600 transition">
                                        <div className="flex items-center gap-4">
                                            <span className="font-mono text-slate-600 text-sm">#{idx + 1}</span>
                                            <div>
                                                <div className="font-bold text-white">{section.title}</div>
                                                <div className="text-xs text-slate-500 uppercase">{section.type} {section.isFree && "• FREE PREVIEW"}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => handleReorderSection(idx, 'up')} disabled={idx === 0} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-20"><ChevronUp className="w-4 h-4" /></button>
                                            <button onClick={() => handleReorderSection(idx, 'down')} disabled={idx === course.sections.length - 1} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-20"><ChevronDown className="w-4 h-4" /></button>
                                            <div className="w-px h-6 bg-slate-800 mx-2"></div>
                                            <button onClick={() => openEditSection(section)} className="p-2 hover:bg-sky-900/30 rounded text-sky-400"><Edit className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteSection(section._id)} className="p-2 hover:bg-red-900/30 rounded text-red-400"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                                {course.sections.length === 0 && <div className="text-center py-8 text-slate-600 italic">No stages defined yet. Add one below.</div>}
                            </div>

                            <div className="border-t border-slate-800 pt-6">
                                <h4 className="text-md font-heading text-secondary mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> ADD NEW STAGE</h4>
                                <form onSubmit={handleAddSection} className="bg-slate-950 p-4 rounded border border-slate-800/50">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <input placeholder="Stage Title" className="w-full bg-slate-900 border border-slate-700 p-2 text-white" value={newSection.title} onChange={e => setNewSection({ ...newSection, title: e.target.value })} required />
                                        <select className="w-full bg-slate-900 border border-slate-700 p-2 text-white" value={newSection.type} onChange={e => setNewSection({ ...newSection, type: e.target.value })}>
                                            <option value="text">Text / Article</option>
                                            <option value="video">Video Embed</option>
                                            <option value="link">External Resource</option>
                                            <option value="quiz">Quiz</option>
                                        </select>
                                    </div>

                                    {newSection.type === "text" && <textarea placeholder="Content (Markdown)" className="w-full bg-slate-900 border border-slate-700 p-2 text-white h-24 mb-4" value={newSection.content} onChange={e => setNewSection({ ...newSection, content: e.target.value })} />}
                                    {newSection.type === "video" && <input placeholder="YouTube Embed URL" className="w-full bg-slate-900 border border-slate-700 p-2 text-white mb-4" value={newSection.videoUrl} onChange={e => setNewSection({ ...newSection, videoUrl: e.target.value })} />}
                                    {newSection.type === "link" && <input placeholder="https://..." className="w-full bg-slate-900 border border-slate-700 p-2 text-white mb-4" value={newSection.linkUrl} onChange={e => setNewSection({ ...newSection, linkUrl: e.target.value })} />}

                                    <div className="flex justify-between items-center">
                                        <label className="flex items-center gap-2 text-white cursor-pointer">
                                            <input type="checkbox" checked={newSection.isFree} onChange={e => setNewSection({ ...newSection, isFree: e.target.checked })} />
                                            <span className="text-sm text-slate-400">Public Preview</span>
                                        </label>
                                        <GameButton type="submit" size="sm">ADD STAGE</GameButton>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Edit Section Modal */}
                {editingSection && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-primary/20 p-6 rounded w-full max-w-2xl shadow-2xl">
                            <h3 className="text-xl font-heading text-white mb-4 border-b border-slate-800 pb-2">EDITING: {editingSection.title}</h3>
                            <form onSubmit={handleUpdateSection} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <input placeholder="Title" className="w-full bg-slate-950 border border-slate-700 p-2 text-white" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} required />
                                    <select className="w-full bg-slate-950 border border-slate-700 p-2 text-white" value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
                                        <option value="text">Text</option>
                                        <option value="video">Video</option>
                                        <option value="link">Link</option>
                                        <option value="quiz">Quiz</option>
                                    </select>
                                </div>

                                {editForm.type === "text" && <textarea className="w-full bg-slate-950 border border-slate-700 p-2 text-white h-48 font-mono text-sm" value={editForm.content} onChange={e => setEditForm({ ...editForm, content: e.target.value })} />}
                                {editForm.type === "video" && (
                                    <>
                                        <input placeholder="Video URL" className="w-full bg-slate-950 border border-slate-700 p-2 text-white" value={editForm.videoUrl} onChange={e => setEditForm({ ...editForm, videoUrl: e.target.value })} />
                                        <textarea placeholder="Description" className="w-full bg-slate-950 border border-slate-700 p-2 text-white h-24" value={editForm.content} onChange={e => setEditForm({ ...editForm, content: e.target.value })} />
                                    </>
                                )}
                                {editForm.type === "quiz" && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="text-white font-bold">Questions</label>
                                            <GameButton type="button" size="sm" onClick={() => setEditForm({ ...editForm, questions: [...editForm.questions, { questionText: "", options: ["", ""], correctOptionIndex: 0 }] })}>
                                                <Plus className="w-3 h-3 mr-1" /> ADD QUESTION
                                            </GameButton>
                                        </div>
                                        <div className="bg-slate-950 border border-slate-800 rounded p-3 sm:p-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm text-slate-200 font-bold">Import from CSV</p>
                                                    <p className="text-xs text-slate-500 font-mono">
                                                        Format: question, option1, option2, option3, option4, correctIndex (1-based).
                                                    </p>
                                                </div>
                                                <label className="inline-flex items-center gap-2 text-xs text-primary cursor-pointer">
                                                    <FileUp className="w-4 h-4" />
                                                    <input
                                                        type="file"
                                                        accept=".csv"
                                                        className="hidden"
                                                        onChange={(e) => handleQuizCsvImport(e.target.files?.[0])}
                                                    />
                                                    IMPORT CSV
                                                </label>
                                            </div>
                                            {csvImportError && (
                                                <p className="text-xs text-red-400 mt-2">{csvImportError}</p>
                                            )}
                                        </div>
                                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                                            {editForm.questions.map((q, qIdx) => (
                                                <div key={qIdx} className="bg-slate-950 p-4 rounded border border-slate-700">
                                                    <div className="flex justify-between mb-2">
                                                        <span className="text-sm text-slate-400">Question {qIdx + 1}</span>
                                                        <button type="button" onClick={() => {
                                                            const newQs = [...editForm.questions];
                                                            newQs.splice(qIdx, 1);
                                                            setEditForm({ ...editForm, questions: newQs });
                                                        }} className="text-red-500 hover:text-red-400">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        placeholder="Question Text"
                                                        className="w-full bg-slate-900 border border-slate-700 p-2 text-white mb-2 min-h-[90px] font-mono text-sm whitespace-pre-wrap"
                                                        value={q.questionText}
                                                        onChange={e => {
                                                            const newQs = [...editForm.questions];
                                                            newQs[qIdx].questionText = e.target.value;
                                                            setEditForm({ ...editForm, questions: newQs });
                                                        }}
                                                    />
                                                    <div className="space-y-2 pl-4 border-l-2 border-slate-800">
                                                        {q.options.map((opt, oIdx) => (
                                                            <div key={oIdx} className="flex items-center gap-2">
                                                                <input
                                                                    type="radio"
                                                                    name={`correct-${qIdx}`}
                                                                    checked={q.correctOptionIndex === oIdx}
                                                                    onChange={() => {
                                                                        const newQs = [...editForm.questions];
                                                                        newQs[qIdx].correctOptionIndex = oIdx;
                                                                        setEditForm({ ...editForm, questions: newQs });
                                                                    }}
                                                                />
                                                                <input
                                                                    placeholder={`Option ${oIdx + 1}`}
                                                                    className="flex-1 bg-slate-900 border border-slate-800 p-1 text-sm text-white"
                                                                    value={opt}
                                                                    onChange={e => {
                                                                        const newQs = [...editForm.questions];
                                                                        newQs[qIdx].options[oIdx] = e.target.value;
                                                                        setEditForm({ ...editForm, questions: newQs });
                                                                    }}
                                                                />
                                                                {q.options.length > 2 && (
                                                                    <button type="button" onClick={() => {
                                                                        const newQs = [...editForm.questions];
                                                                        newQs[qIdx].options.splice(oIdx, 1);
                                                                        // Adjust correct index if needed
                                                                        if (newQs[qIdx].correctOptionIndex >= oIdx && newQs[qIdx].correctOptionIndex > 0) {
                                                                            newQs[qIdx].correctOptionIndex = Math.min(newQs[qIdx].correctOptionIndex, newQs[qIdx].options.length - 1);
                                                                        }
                                                                        setEditForm({ ...editForm, questions: newQs });
                                                                    }} className="text-red-500 hover:text-red-400 text-xs">
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            className="text-xs text-primary hover:underline mt-2 flex items-center gap-1"
                                                            onClick={() => {
                                                                const newQs = [...editForm.questions];
                                                                newQs[qIdx].options.push("");
                                                                setEditForm({ ...editForm, questions: newQs });
                                                            }}
                                                        >
                                                            <Plus className="w-3 h-3" /> Add Option
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-between items-center pt-4">
                                    <label className="flex items-center gap-2 text-white cursor-pointer">
                                        <input type="checkbox" checked={editForm.isFree} onChange={e => setEditForm({ ...editForm, isFree: e.target.checked })} />
                                        Free Preview
                                    </label>
                                    <div className="flex gap-2">
                                        <GameButton type="button" variant="ghost" onClick={() => setEditingSection(null)}>CANCEL</GameButton>
                                        <GameButton type="submit">SAVE UPDATES</GameButton>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
