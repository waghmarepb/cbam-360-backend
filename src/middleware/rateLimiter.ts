import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

const defaultOptions: RateLimiterOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per window
  message: 'Too many requests, please try again later.'
};

// In-memory store (use Redis in production for multi-instance deployments)
const stores: Map<string, RateLimitStore> = new Map();

function getStore(name: string): RateLimitStore {
  if (!stores.has(name)) {
    stores.set(name, {});
  }
  return stores.get(name)!;
}

function cleanupStore(store: RateLimitStore): void {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  }
}

export function createRateLimiter(name: string, options: Partial<RateLimiterOptions> = {}) {
  const config = { ...defaultOptions, ...options };
  const store = getStore(name);

  // Cleanup expired entries periodically
  setInterval(() => cleanupStore(store), config.windowMs);

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting if configured
    if (config.skip && config.skip(req)) {
      return next();
    }

    const key = config.keyGenerator 
      ? config.keyGenerator(req) 
      : req.ip || req.socket.remoteAddress || 'unknown';
    
    const now = Date.now();
    const record = store[key];

    if (!record || record.resetTime < now) {
      // Create new record
      store[key] = {
        count: 1,
        resetTime: now + config.windowMs
      };
    } else {
      // Increment existing record
      store[key].count++;
    }

    const current = store[key];
    const remaining = Math.max(0, config.maxRequests - current.count);
    const resetTime = new Date(current.resetTime);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime.toISOString());

    if (current.count > config.maxRequests) {
      res.status(429).json({
        success: false,
        message: config.message,
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      });
      return;
    }

    next();
  };
}

// Pre-configured rate limiters
export const authRateLimiter = createRateLimiter('auth', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later.'
});

export const apiRateLimiter = createRateLimiter('api', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
  message: 'Rate limit exceeded. Please slow down.'
});

export const uploadRateLimiter = createRateLimiter('upload', {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 50, // 50 uploads per hour
  message: 'Upload limit exceeded. Please try again later.'
});

export default createRateLimiter;

