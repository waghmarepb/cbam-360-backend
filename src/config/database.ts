import mongoose from 'mongoose';

// Cache the connection promise for serverless
let connectionPromise: Promise<typeof mongoose> | null = null;
let isConnected = false;

const connectDB = async (): Promise<void> => {
  console.log('connectDB called, readyState:', mongoose.connection.readyState, 'isConnected:', isConnected);

  // If already connected, return immediately
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('Using existing MongoDB connection');
    return;
  }

  // If connection is in progress, wait for it (with timeout)
  if (connectionPromise) {
    console.log('Connection in progress, waiting...');
    try {
      await Promise.race([
        connectionPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection wait timeout')), 10000))
      ]);
      return;
    } catch (e) {
      console.log('Connection wait failed, retrying...');
      connectionPromise = null;
    }
  }

  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    console.log('Connecting to MongoDB...', mongoURI ? 'URI present' : 'URI missing');

    // Set mongoose options for serverless
    mongoose.set('bufferCommands', false);

    connectionPromise = mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    await connectionPromise;
    isConnected = true;

    console.log('✅ MongoDB connected successfully, readyState:', mongoose.connection.readyState);

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      isConnected = false;
      connectionPromise = null;
    });

  } catch (error: any) {
    console.error('❌ MongoDB connection failed:', error?.message || error);
    isConnected = false;
    connectionPromise = null;
    // Don't exit in serverless environment - let individual requests handle connection errors
    if (process.env.VERCEL !== '1') {
      process.exit(1);
    }
    throw error;
  }
};

// Export a function to ensure connection before operations
export const ensureConnection = async () => {
  if (!isConnected || mongoose.connection.readyState !== 1) {
    await connectDB();
  }
};

export default connectDB;
