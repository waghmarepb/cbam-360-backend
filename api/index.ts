import { VercelRequest, VercelResponse } from '@vercel/node';

// Allowed origins for CORS
const allowedOrigins = [
  'https://cbam-360-frontend.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

// Set CORS headers on response
function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// Cache the app instance
let app: any = null;

async function getApp() {
  if (!app) {
    // Dynamically import to avoid issues at module load time
    const serverModule = await import('../src/server');
    app = serverModule.default || serverModule;
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Always set CORS headers first
  setCorsHeaders(req, res);
  
  // Handle preflight immediately
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  
  try {
    const expressApp = await getApp();
    // Forward to Express app
    return expressApp(req, res);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV !== 'production' ? String(error) : undefined
    });
  }
}
