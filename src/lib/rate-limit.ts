
type RateLimitInfo = {
    count: number;
    reset: number;
};

const rateLimits = new Map<string, RateLimitInfo>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

type RateLimitOptions = {
    key?: string;
    maxAttempts?: number;
    windowMs?: number;
};

const getScopedKey = (ip: string, options?: RateLimitOptions) => `${options?.key || "default"}:${ip}`;
const getLimit = (options?: RateLimitOptions) => options?.maxAttempts ?? MAX_ATTEMPTS;
const getWindow = (options?: RateLimitOptions) => options?.windowMs ?? WINDOW_MS;

export const rateLimit = {
    check: (ip: string, options?: RateLimitOptions) => {
        const now = Date.now();
        const scopedKey = getScopedKey(ip, options);
        const limit = getLimit(options);
        const window = getWindow(options);
        const info = rateLimits.get(scopedKey);

        if (!info) {
            return {
                limited: false,
                remainingAttempts: limit,
                resetTime: now + window
            };
        }

        if (now > info.reset) {
            // Window expired, reset
            rateLimits.delete(scopedKey);
            return {
                limited: false,
                remainingAttempts: limit,
                resetTime: now + window
            };
        }

        if (info.count >= limit) {
            return {
                limited: true,
                remainingAttempts: 0,
                resetTime: info.reset
            };
        }

        return {
            limited: false,
            remainingAttempts: limit - info.count,
            resetTime: info.reset
        };
    },

    increment: (ip: string, options?: RateLimitOptions) => {
        const now = Date.now();
        const scopedKey = getScopedKey(ip, options);
        const window = getWindow(options);
        const info = rateLimits.get(scopedKey);

        if (!info || now > info.reset) {
            rateLimits.set(scopedKey, {
                count: 1,
                reset: now + window
            });
        } else {
            rateLimits.set(scopedKey, {
                ...info,
                count: info.count + 1
            });
        }
    },

    clear: (ip: string, options?: RateLimitOptions) => {
        const scopedKey = getScopedKey(ip, options);
        rateLimits.delete(scopedKey);
    }
};
