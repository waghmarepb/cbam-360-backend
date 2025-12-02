import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database';
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

// Connect to MongoDB and seed data
connectDB().then(async () => {
  await seedCNCodes();
  await seedEmissionFactors();
  await seedVenusWireData(); // Seed Venus Wire Industries demo data
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

// Start server
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

export default app;

