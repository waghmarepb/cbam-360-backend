import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import User, { UserRole } from '../models/User';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import auditService from '../services/auditService';
import { AuditResource } from '../models/AuditLog';
import mongoose from 'mongoose';

const router = Router();

router.use(authenticate);

// @route   GET /api/users
// @desc    Get all users in organisation
// @access  Private (Admin, Manager)
router.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  async (req: AuthRequest, res: Response) => {
    try {
      const users = await User.find({ organisation: req.user?.organisation })
        .select('-passwordHash -refreshToken')
        .sort({ createdAt: -1 });

      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
  }
);

// @route   GET /api/users/me
// @desc    Get current user profile
// @access  Private
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?._id)
      .select('-passwordHash -refreshToken')
      .populate('organisation', 'name type');

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// @route   PUT /api/users/me
// @desc    Update current user profile
// @access  Private
router.put(
  '/me',
  [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('phone').optional().trim()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { firstName, lastName, phone } = req.body;
      const updates: Record<string, string> = {};

      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
      if (phone !== undefined) updates.phone = phone;

      const user = await User.findByIdAndUpdate(
        req.user?._id,
        updates,
        { new: true }
      ).select('-passwordHash -refreshToken');

      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: user
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
  }
);

// @route   PUT /api/users/me/password
// @desc    Change password
// @access  Private
router.put(
  '/me/password',
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.user?._id);
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        res.status(400).json({ success: false, message: 'Current password is incorrect' });
        return;
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(newPassword, salt);
      await user.save();

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to change password' });
    }
  }
);

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private (Admin, Manager)
router.get(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await User.findOne({
        _id: req.params.id,
        organisation: req.user?.organisation
      }).select('-passwordHash -refreshToken');

      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      res.json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch user' });
    }
  }
);

// @route   PUT /api/users/:id
// @desc    Update user (Admin only)
// @access  Private (Admin)
router.put(
  '/:id',
  authorize(UserRole.ADMIN),
  [
    param('id').isMongoId(),
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('role').optional().isIn(Object.values(UserRole)),
    body('isActive').optional().isBoolean()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { firstName, lastName, role, isActive } = req.body;

      // Prevent self-demotion
      if (req.params.id === req.user?._id.toString() && role && role !== UserRole.ADMIN) {
        res.status(400).json({ success: false, message: 'Cannot change your own role' });
        return;
      }

      const updates: Record<string, unknown> = {};
      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
      if (role) updates.role = role;
      if (isActive !== undefined) updates.isActive = isActive;

      const user = await User.findOneAndUpdate(
        { _id: req.params.id, organisation: req.user?.organisation },
        updates,
        { new: true }
      ).select('-passwordHash -refreshToken');

      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      // Audit log
      await auditService.logUpdate(
        req.user?.organisation as mongoose.Types.ObjectId,
        req.user?._id as mongoose.Types.ObjectId,
        AuditResource.USER,
        user._id,
        `${user.firstName} ${user.lastName}`,
        Object.entries(updates).map(([field, newValue]) => ({
          field,
          newValue: String(newValue)
        })),
        req
      );

      res.json({
        success: true,
        message: 'User updated successfully',
        data: user
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update user' });
    }
  }
);

// @route   DELETE /api/users/:id
// @desc    Delete/deactivate user
// @access  Private (Admin)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      // Prevent self-deletion
      if (req.params.id === req.user?._id.toString()) {
        res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        return;
      }

      const user = await User.findOneAndUpdate(
        { _id: req.params.id, organisation: req.user?.organisation },
        { isActive: false },
        { new: true }
      ).select('-passwordHash -refreshToken');

      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      // Audit log
      await auditService.logDelete(
        req.user?.organisation as mongoose.Types.ObjectId,
        req.user?._id as mongoose.Types.ObjectId,
        AuditResource.USER,
        user._id,
        `${user.firstName} ${user.lastName}`,
        req
      );

      res.json({ success: true, message: 'User deactivated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
  }
);

// @route   POST /api/users/invite
// @desc    Invite new user to organisation
// @access  Private (Admin, Manager)
router.post(
  '/invite',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  [
    body('email').isEmail().normalizeEmail(),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('role').isIn([UserRole.MANAGER, UserRole.OPERATOR, UserRole.VIEWER])
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { email, firstName, lastName, role } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(400).json({ success: false, message: 'User with this email already exists' });
        return;
      }

      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-12);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(tempPassword, salt);

      const user = await User.create({
        email,
        firstName,
        lastName,
        passwordHash,
        role,
        organisation: req.user?.organisation,
        isActive: true,
        mustChangePassword: true
      });

      // Audit log
      await auditService.logCreate(
        req.user?.organisation as mongoose.Types.ObjectId,
        req.user?._id as mongoose.Types.ObjectId,
        AuditResource.USER,
        user._id,
        `${firstName} ${lastName}`,
        req
      );

      // In production, send email with temporary password
      // For now, return it in response (development only)
      res.status(201).json({
        success: true,
        message: 'User invited successfully',
        data: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tempPassword // Remove in production!
        }
      });
    } catch (error) {
      console.error('Invite user error:', error);
      res.status(500).json({ success: false, message: 'Failed to invite user' });
    }
  }
);

export default router;

