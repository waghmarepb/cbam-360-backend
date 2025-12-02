import { Request, Response, NextFunction } from 'express';

interface RequestLog {
  timestamp: string;
  method: string;
  url: string;
  ip: string;
  userAgent: string;
  userId?: string;
  statusCode?: number;
  duration?: number;
  error?: string;
}

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m'
};

function getStatusColor(statusCode: number): string {
  if (statusCode >= 500) return colors.red;
  if (statusCode >= 400) return colors.yellow;
  if (statusCode >= 300) return colors.cyan;
  return colors.green;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function requestLogger(options: { 
  skip?: (req: Request) => boolean;
  logBody?: boolean;
} = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip logging for certain requests
    if (options.skip && options.skip(req)) {
      return next();
    }

    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // Capture original end function
    const originalEnd = res.end;

    // Override end to log after response
    res.end = function(chunk?: unknown, encoding?: BufferEncoding | (() => void), callback?: () => void) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const statusColor = getStatusColor(statusCode);

      const log: RequestLog = {
        timestamp,
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
        statusCode,
        duration
      };

      // Add user ID if available
      if ((req as unknown as { user?: { _id?: string } }).user?._id) {
        log.userId = (req as unknown as { user: { _id: string } }).user._id.toString();
      }

      // Format log message for console
      const logMessage = [
        `${colors.gray}[${timestamp}]${colors.reset}`,
        `${colors.bold}${req.method}${colors.reset}`,
        req.originalUrl || req.url,
        `${statusColor}${statusCode}${colors.reset}`,
        `${colors.gray}${formatDuration(duration)}${colors.reset}`
      ].join(' ');

      // Log to console
      if (statusCode >= 400) {
        console.error(logMessage);
      } else {
        console.log(logMessage);
      }

      // In production, you might want to send logs to a logging service
      if (process.env.NODE_ENV === 'production' && process.env.LOG_SERVICE_URL) {
        // Async log to external service (non-blocking)
        sendToLogService(log).catch(() => {});
      }

      // Call original end
      if (typeof encoding === 'function') {
        return originalEnd.call(this, chunk, encoding);
      }
      return originalEnd.call(this, chunk, encoding, callback);
    };

    next();
  };
}

async function sendToLogService(log: RequestLog): Promise<void> {
  // Placeholder for external logging service integration
  // In production, you would send logs to services like:
  // - AWS CloudWatch
  // - Datadog
  // - Loggly
  // - ELK Stack
}

// Access log format (for file logging)
export function formatAccessLog(req: Request, res: Response, duration: number): string {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const status = res.statusCode;
  const userAgent = req.get('user-agent') || '-';
  const ip = req.ip || req.socket.remoteAddress || '-';
  
  // Apache Combined Log Format
  return `${ip} - - [${timestamp}] "${method} ${url} HTTP/1.1" ${status} - "-" "${userAgent}" ${duration}ms`;
}

// Error logging
export function logError(error: Error, req?: Request): void {
  const timestamp = new Date().toISOString();
  
  console.error(`${colors.red}[ERROR]${colors.reset} [${timestamp}]`);
  console.error(`Message: ${error.message}`);
  
  if (req) {
    console.error(`URL: ${req.method} ${req.originalUrl || req.url}`);
    console.error(`IP: ${req.ip || req.socket.remoteAddress}`);
  }
  
  if (process.env.NODE_ENV !== 'production') {
    console.error(`Stack: ${error.stack}`);
  }
}

export default requestLogger;

