import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import authRoutes from '../../src/routes/auth';
import User from '../../src/models/User';
import Organisation from '../../src/models/Organisation';
import { createTestUser, createTestOrganisation } from '../helpers/testUtils';

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'SecurePassword123!',
          firstName: 'New',
          lastName: 'User',
          organisationName: 'New Organisation',
          organisationType: 'producer'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user).toHaveProperty('email', 'newuser@test.com');

      // Verify user was created in database
      const user = await User.findOne({ email: 'newuser@test.com' });
      expect(user).toBeTruthy();
      expect(user?.firstName).toBe('New');
    });

    it('should reject registration with existing email', async () => {
      // Create existing user
      await createTestUser({ email: 'existing@test.com' });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@test.com',
          password: 'SecurePassword123!',
          firstName: 'Another',
          lastName: 'User',
          organisationName: 'Another Org',
          organisationType: 'producer'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePassword123!',
          firstName: 'Test',
          lastName: 'User',
          organisationName: 'Test Org',
          organisationType: 'producer'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject registration with short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@test.com',
          password: '123',
          firstName: 'Test',
          lastName: 'User',
          organisationName: 'Test Org',
          organisationType: 'producer'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject registration with missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@test.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      // Create test user
      await createTestUser({
        email: 'login@test.com',
        password: 'TestPassword123!'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('login@test.com');
    });

    it('should reject login with wrong password', async () => {
      await createTestUser({
        email: 'wrongpass@test.com',
        password: 'CorrectPassword123!'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrongpass@test.com',
          password: 'WrongPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'SomePassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject login for inactive user', async () => {
      const { user } = await createTestUser({
        email: 'inactive@test.com',
        password: 'TestPassword123!'
      });

      // Deactivate user
      await User.findByIdAndUpdate(user._id, { isActive: false });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'inactive@test.com',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const { refreshToken } = await createTestUser({
        email: 'refresh@test.com'
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});

