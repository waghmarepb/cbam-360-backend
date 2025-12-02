import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User, { UserRole } from '../../src/models/User';
import Organisation, { OrganisationType } from '../../src/models/Organisation';

export interface TestUser {
  user: typeof User.prototype;
  organisation: typeof Organisation.prototype;
  accessToken: string;
  refreshToken: string;
}

/**
 * Create a test organisation
 */
export async function createTestOrganisation(overrides: Partial<{
  name: string;
  type: OrganisationType;
}> = {}) {
  const organisation = await Organisation.create({
    name: overrides.name || 'Test Organisation',
    type: overrides.type || OrganisationType.PRODUCER,
    address: {
      street: '123 Test Street',
      city: 'Test City',
      postalCode: '12345',
      countryCode: 'IN'
    }
  });
  
  return organisation;
}

/**
 * Create a test user with organisation
 */
export async function createTestUser(overrides: Partial<{
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organisationId?: mongoose.Types.ObjectId;
}> = {}): Promise<TestUser> {
  // Create organisation if not provided
  let organisation;
  if (overrides.organisationId) {
    organisation = await Organisation.findById(overrides.organisationId);
  } else {
    organisation = await createTestOrganisation();
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(overrides.password || 'TestPassword123!', salt);

  // Create user
  const user = await User.create({
    email: overrides.email || `test-${Date.now()}@example.com`,
    passwordHash,
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    role: overrides.role || UserRole.ADMIN,
    organisation: organisation!._id,
    isActive: true
  });

  // Generate tokens
  const accessToken = jwt.sign(
    { 
      userId: user._id, 
      organisationId: organisation!._id, 
      role: user.role 
    },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );

  return {
    user,
    organisation: organisation!,
    accessToken,
    refreshToken
  };
}

/**
 * Create multiple test users
 */
export async function createTestUsers(count: number): Promise<TestUser[]> {
  const users: TestUser[] = [];
  const organisation = await createTestOrganisation();

  for (let i = 0; i < count; i++) {
    const user = await createTestUser({
      email: `user${i}@test.com`,
      organisationId: organisation._id
    });
    users.push(user);
  }

  return users;
}

/**
 * Generate expired token for testing
 */
export function generateExpiredToken(userId: string): string {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET!,
    { expiresIn: '-1h' }
  );
}

/**
 * Generate invalid token
 */
export function generateInvalidToken(): string {
  return 'invalid.token.string';
}

/**
 * Wait for a specified time (useful for rate limit tests)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a valid MongoDB ObjectId
 */
export function createObjectId(): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId();
}

