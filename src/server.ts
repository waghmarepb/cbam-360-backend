import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB, { ensureConnection } from './config/database';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { securityHeaders, removePoweredBy, corsConfig } from './middleware/security';
import { apiRateLimiter, authRateLimiter } from './middleware/rateLimiter';
import requestLogger from './middleware/requestLogger';
import seedCNCodes from './seeds/cnCodes';
import seedEmissionFactors from './seeds/emissionFactors';
import seedVenusWireData from './seeds/venusWireData';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// For non-serverless: Connect to MongoDB and seed data at startup
if (process.env.VERCEL !== '1') {
  connectDB().then(async () => {
    await seedCNCodes();
    await seedEmissionFactors();
    await seedVenusWireData();
  });
}

// Handle OPTIONS preflight requests FIRST - before any other middleware
app.options('*', (req, res) => {
  const allowedOrigins = [
    'https://cbam-360-frontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin || process.env.NODE_ENV !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

// Security middleware
app.use(removePoweredBy);
app.use(securityHeaders);

// CORS configuration
app.use(cors(corsConfig()));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger({
  skip: (req) => req.path === '/api/health' // Skip health check logs
}));

// Rate limiting
app.use('/api/auth', authRateLimiter);
app.use('/api', apiRateLimiter);

// Ensure database connection for serverless (before API routes)
app.use('/api', async (req, res, next) => {
  try {
    console.log('Attempting database connection...');
    await ensureConnection();
    console.log('Database connection successful');
    next();
  } catch (error: any) {
    console.error('Database connection error:', error?.message || error);
    console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    res.status(503).json({
      success: false,
      message: 'Database connection failed',
      details: error?.message || 'Unknown error',
      mongoUri: process.env.MONGODB_URI ? 'Set (hidden)' : 'NOT SET - using fallback'
    });
  }
});

// API Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to CBAM360 API',
    version: '1.0.0',
    documentation: '/api/docs'
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server only if not running on Vercel (serverless)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║   🌍 CBAM360 API Server                       ║
  ║                                               ║
  ║   🚀 Server running on port ${PORT}             ║
  ║   📡 API available at http://localhost:${PORT}  ║
  ║   🔧 Environment: ${process.env.NODE_ENV || 'development'}              ║
  ║                                               ║
  ╚═══════════════════════════════════════════════╝
    `);
  });
}

// Export for Vercel serverless
export default app;
module.exports = app;

