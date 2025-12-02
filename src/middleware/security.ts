import { Request, Response, NextFunction } from 'express';

// Security headers middleware (similar to helmet)
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https:; " +
    "frame-ancestors 'none';"
  );
  
  // Strict Transport Security (HSTS)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  // Permissions Policy
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );
  
  next();
}

// Remove sensitive headers
export function removePoweredBy(req: Request, res: Response, next: NextFunction) {
  res.removeHeader('X-Powered-By');
  next();
}

// CORS configuration for production
export function corsConfig() {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
  
  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        callback(null, true);
        return;
      }
      
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400 // 24 hours
  };
}

// Sanitize request body
export function sanitizeBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj: Record<string, unknown>): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove potential NoSQL injection operators
      if (key.startsWith('$')) {
        delete obj[key];
        continue;
      }
      // Basic HTML entity encoding for XSS prevention
      obj[key] = (obj[key] as string)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key] as Record<string, unknown>);
    }
  }
}

export default {
  securityHeaders,
  removePoweredBy,
  corsConfig,
  sanitizeBody
};

