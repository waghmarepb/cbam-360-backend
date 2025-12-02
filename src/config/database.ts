import mongoose from 'mongoose';

// Cache the connection promise for serverless
let connectionPromise: Promise<typeof mongoose> | null = null;
let isConnected = false;

const connectDB = async (): Promise<void> => {
  // If already connected, return immediately
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('Using existing MongoDB connection');
    return;
  }

  // If connection is in progress, wait for it
  if (connectionPromise) {
    await connectionPromise;
    return;
  }

  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://waghmarepb_db_user:Z8bfCovJWHe1gkUZ@cluster0.dhgdel3.mongodb.net/cbam360?retryWrites=true&w=majority&appName=Cluster0';

    // Set mongoose options for serverless
    mongoose.set('bufferCommands', false);

    connectionPromise = mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await connectionPromise;
    isConnected = true;

    console.log('✅ MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      isConnected = false;
      connectionPromise = null;
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
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
