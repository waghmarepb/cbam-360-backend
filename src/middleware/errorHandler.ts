import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  if (process.env.NODE_ENV === 'development') {
    res.status(statusCode).json({
      success: false,
      status,
      message: err.message,
      stack: err.stack
    });
  } else {
    // Production - don't leak error details
    res.status(statusCode).json({
      success: false,
      status,
      message: err.isOperational ? err.message : 'Something went wrong'
    });
  }
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
};

export class ApiError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

