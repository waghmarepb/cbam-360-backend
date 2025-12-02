import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import User, { UserRole } from '../models/User';
import Organisation, { OrganisationType } from '../models/Organisation';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Validation middleware
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('organisationName').trim().notEmpty().withMessage('Organisation name is required'),
  body('organisationType')
    .isIn(Object.values(OrganisationType))
    .withMessage('Valid organisation type is required'),
  body('address.street').trim().notEmpty().withMessage('Street address is required'),
  body('address.city').trim().notEmpty().withMessage('City is required'),
  body('address.postalCode').trim().notEmpty().withMessage('Postal code is required'),
  body('address.country').trim().notEmpty().withMessage('Country is required'),
  body('address.countryCode').isLength({ min: 2, max: 2 }).withMessage('Country code must be 2 characters')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// Generate tokens
const generateTokens = (user: { _id: string; email: string; role: UserRole }) => {
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';
  
  const accessToken = jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const refreshToken = jwt.sign(
    { userId: user._id },
    jwtRefreshSecret,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  return { accessToken, refreshToken };
};

// @route   POST /api/auth/register
// @desc    Register new user with organisation
// @access  Public
router.post('/register', registerValidation, async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const {
      email,
      password,
      firstName,
      lastName,
      organisationName,
      organisationType,
      address
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
      return;
    }

    // Create organisation
    const organisation = await Organisation.create({
      name: organisationName,
      type: organisationType,
      address,
      contactEmail: email
    });

    // Create user as admin of the organisation
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role: UserRole.ADMIN,
      organisation: organisation._id
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({
      _id: user._id.toString(),
      email: user.email,
      role: user.role
    });

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organisation: {
            id: organisation._id,
            name: organisation.name,
            type: organisation.type
          }
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginValidation, async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ email }).select('+password').populate('organisation');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Check if account is active
    if (!user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
      return;
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({
      _id: user._id.toString(),
      email: user.email,
      role: user.role
    });

    // Update refresh token and last login
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organisation: user.organisation
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
      return;
    }

    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';
    
    const decoded = jwt.verify(refreshToken, jwtRefreshSecret) as { userId: string };
    
    const user = await User.findById(decoded.userId).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
      return;
    }

    // Generate new tokens
    const tokens = generateTokens({
      _id: user._id.toString(),
      email: user.email,
      role: user.role
    });

    // Update refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user) {
      req.user.refreshToken = undefined;
      await req.user.save();
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?._id).populate('organisation');

    res.json({
      success: true,
      data: {
        id: user?._id,
        email: user?.email,
        firstName: user?.firstName,
        lastName: user?.lastName,
        role: user?.role,
        organisation: user?.organisation,
        lastLogin: user?.lastLogin
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user data'
    });
  }
});

export default router;

