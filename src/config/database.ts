import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://waghmarepb_db_user:Z8bfCovJWHe1gkUZ@cluster0.dhgdel3.mongodb.net/cbam360?retryWrites=true&w=majority&appName=Cluster0';

    await mongoose.connect(mongoURI);

    console.log('✅ MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    // Don't exit in serverless environment - let individual requests handle connection errors
    if (process.env.VERCEL !== '1') {
      process.exit(1);
    }
    throw error;
  }
};

export default connectDB;

