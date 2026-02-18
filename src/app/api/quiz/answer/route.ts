import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Section from "@/models/Section";
import { verifyToken } from "@/lib/auth";
import { awardXP } from "@/lib/gamification";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("session_token")?.value;

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { sectionId, questionIndex, selectedOptionIndex } = await req.json();

        if (!sectionId || questionIndex === undefined || selectedOptionIndex === undefined) {
            return NextResponse.json({ error: "Missing Parameters" }, { status: 400 });
        }

        await dbConnect();

        // Fetch User and Section
        const user = await User.findById(payload.userId);
        const section = await Section.findById(sectionId);

        if (!user || !section) {
            return NextResponse.json({ error: "Not Found" }, { status: 404 });
        }

        // Validate Question
        const questions = section.questions || [];
        const question = questions[questionIndex];

        if (!question) {
            return NextResponse.json({ error: "Question not found" }, { status: 404 });
        }

        // Check Answer
        const isCorrect = question.correctOptionIndex === selectedOptionIndex;
        const sId = String(sectionId);
        const answerId = `${sId}-${questionIndex}`;

        // Use a more robust check for already answered
        // Force strings and remove any nulls/undefineds
        // Safeguard: If the previous schema created objects { type: "..." }, extract the string.
        const rawAnswers = user.answeredQuestions || [];
        const answeredQuestions = (Array.isArray(rawAnswers) ? rawAnswers : []).map((id) => {
            if (typeof id === "object" && id !== null && "type" in id) {
                return String((id as { type?: unknown }).type);
            }
            return String(id);
        });
        const alreadyAnswered = answeredQuestions.includes(answerId);

        // Check if the section itself is marked completed
        const isSectionAlreadyDone = (user.completedSections || []).some((id) => String(id) === sId);

        console.log(`[QUIZ] User: ${user.email}, SID: ${sId}, QIdx: ${questionIndex}`);
        console.log(`[QUIZ] Flags - alreadyAnswered: ${alreadyAnswered}, isSectionDone: ${isSectionAlreadyDone}, isCorrect: ${isCorrect}`);

        // DETAILED LOG FOR DEBUGGING XP LEAK
        if (!alreadyAnswered && isSectionAlreadyDone) {
            console.log(`[QUIZ-RESTRICTION] Blocking XP because Section is already completed even though AnswerId was missing.`);
        }

        let xpAwarded = 0;
        let xpReason = "";

        // ONLY award XP if correct AND not already answered AND section not completed
        if (isCorrect) {
            if (!alreadyAnswered && !isSectionAlreadyDone) {
                // Award XP - pass the user object to avoid overwriting
                const result = await awardXP(user, 10, `quiz-${answerId}`);
                xpAwarded = result?.xpAwarded || 0;
                if (xpAwarded > 0) xpReason = "Correct answer";
                console.log(`[QUIZ-XP] Awarded ${xpAwarded} XP to ${user.email}`);
            } else {
                console.log(`[QUIZ-XP] XP BLOCKED (Already Answered: ${alreadyAnswered}, Section Done: ${isSectionAlreadyDone})`);
            }

            // Always try to update progress to ensure persistence
            try {
                // Update individual answer tracking
                type UserProgressUpdate = {
                    $addToSet: {
                        answeredQuestions: string;
                        completedSections?: unknown;
                    };
                    $set: {
                        xp: number;
                        level: number;
                        updatedAt: Date;
                    };
                };

                const finalUpdate: UserProgressUpdate = {
                    $addToSet: { answeredQuestions: answerId },
                    $set: {
                        xp: user.xp,
                        level: user.level,
                        updatedAt: new Date()
                    }
                };

                // Check if this was the last question for this section
                const updatedAnswered = [...(user.answeredQuestions || []), answerId];
                const sectionQuestionsCount = questions.length;
                const answeredForThisSection = updatedAnswered.filter((id) => String(id).startsWith(`${sId}-`));

                // If all questions are answered, mark section as completed too
                if (answeredForThisSection.length >= sectionQuestionsCount) {
                    finalUpdate.$addToSet.completedSections = section._id;
                    console.log(`[QUIZ] Marking section ${sectionId} as COMPLETED`);
                }

                const updatedUser = await User.findByIdAndUpdate(
                    payload.userId,
                    finalUpdate,
                    { new: true, runValidators: false }
                );

                if (updatedUser) {
                    const count = updatedUser.answeredQuestions?.length || 0;
                    const isSectionDone = updatedUser.completedSections?.some((id) => String(id) === String(sectionId));
                    console.log(`[QUIZ-SUCCESS] User: ${updatedUser.email}, Answers: ${count}, SectionDone: ${isSectionDone}`);
                }

                // Force Next.js to re-fetch the course page data on next load
                revalidatePath(`/courses`, 'layout');
                revalidatePath(`/courses/${section.courseId}`, 'page');
            } catch (saveError) {
                console.error(`[QUIZ] SAVE ERROR:`, saveError);
                return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: true,
            isCorrect,
            correctOptionIndex: question.correctOptionIndex,
            xpAwarded,
            xpReason,
            alreadyAnswered
        });

    } catch (error) {
        console.error("Quiz Answer Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
