import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

// Connect to in-memory MongoDB before all tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
});

// Clear all collections after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Disconnect and stop MongoDB after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing';
process.env.JWT_EXPIRY = '1h';
process.env.JWT_REFRESH_EXPIRY = '7d';

