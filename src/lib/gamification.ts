import User, { IUser } from "@/models/User";
import { calculateLevel, LEVEL_FORMULA_CONST } from "./gamification-utils";

export { calculateLevel, LEVEL_FORMULA_CONST };

export function xpForNextLevel(currentLevel: number): number {
    return Math.floor(LEVEL_FORMULA_CONST * Math.pow(currentLevel + 1, 1.5));
}

export interface XPAwardResult {
    previousLevel: number;
    newLevel: number;
    levelUp: boolean;
    xpAwarded: number;
    newTotalXP: number;
}

export async function awardXP(
    userOrId: string | IUser,
    amount: number,
    _reason?: string
): Promise<XPAwardResult | null> {
    let user: IUser | null;

    if (typeof userOrId === 'string') {
        user = await User.findById(userOrId);
    } else {
        user = userOrId;
    }

    if (!user) return null;

    const previousLevel = user.level || 1;
    user.xp = (user.xp || 0) + amount;

    const newLevel = calculateLevel(user.xp);

    let levelUp = false;
    if (newLevel > previousLevel) {
        user.level = newLevel;
        levelUp = true;
    }

    // Only save if we fetched the user by ID locally
    if (typeof userOrId === 'string') {
        await user.save();
    }

    return {
        previousLevel,
        newLevel,
        levelUp,
        xpAwarded: amount,
        newTotalXP: user.xp,
    };
}

export async function updateStreak(user: IUser): Promise<boolean> {
    const now = new Date();
    const lastActive = user.streak?.lastActiveDate ? new Date(user.streak.lastActiveDate) : null;

    if (!lastActive) {
        user.streak = {
            count: 1,
            lastActiveDate: now,
        };
        await user.save();
        return true;
    }

    // Reset hours to compare only dates
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastDate = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());
    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let updated = false;

    if (user.streak.count === 0) {
        user.streak.count = 1;
        user.streak.lastActiveDate = now;
        updated = true;
    } else if (diffDays === 1) {
        // Consecutive day
        user.streak.count += 1;
        user.streak.lastActiveDate = now;
        updated = true;
    } else if (diffDays > 1) {
        // Streak broken
        user.streak.count = 1;
        user.streak.lastActiveDate = now;
        updated = true;
    }

    if (updated) {
        await user.save();
    }

    return updated;
}
