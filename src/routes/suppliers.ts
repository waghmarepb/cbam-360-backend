import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import crypto from 'crypto';
import { Supplier, SupplierDeclaration, SupplierStatus, DeclarationStatus } from '../models/Supplier';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

router.use(authenticate);

// ==================== SUPPLIERS ====================

// @route   GET /api/suppliers
// @desc    Get all suppliers for current organisation
// @access  Private
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const orgId = req.user?.organisation;

    const filter: Record<string, unknown> = { organisation: orgId };
    
    if (status) filter.status = status;
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [suppliers, total] = await Promise.all([
      Supplier.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Supplier.countDocuments(filter)
    ]);

    // Get declaration counts for each supplier
    const supplierIds = suppliers.map(s => s._id);
    const declarationCounts = await SupplierDeclaration.aggregate([
      { $match: { supplier: { $in: supplierIds } } },
      { $group: { _id: '$supplier', count: { $sum: 1 } } }
    ]);

    const countMap = new Map(declarationCounts.map(d => [d._id.toString(), d.count]));
    
    const suppliersWithCounts = suppliers.map(s => ({
      ...s.toObject(),
      declarationCount: countMap.get(s._id.toString()) || 0
    }));

    res.json({
      success: true,
      data: suppliersWithCounts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch suppliers' });
  }
});

// @route   GET /api/suppliers/stats
// @desc    Get supplier statistics
// @access  Private
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organisation;

    const [
      totalSuppliers,
      activeSuppliers,
      pendingDeclarations,
      verifiedDeclarations
    ] = await Promise.all([
      Supplier.countDocuments({ organisation: orgId }),
      Supplier.countDocuments({ organisation: orgId, status: SupplierStatus.ACTIVE }),
      SupplierDeclaration.countDocuments({ organisation: orgId, status: DeclarationStatus.PENDING }),
      SupplierDeclaration.countDocuments({ organisation: orgId, status: DeclarationStatus.VERIFIED })
    ]);

    res.json({
      success: true,
      data: {
        totalSuppliers,
        activeSuppliers,
        pendingDeclarations,
        verifiedDeclarations
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// @route   GET /api/suppliers/:id
// @desc    Get supplier by ID
// @access  Private
router.get(
  '/:id',
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const supplier = await Supplier.findOne({
        _id: req.params.id,
        organisation: req.user?.organisation
      });

      if (!supplier) {
        res.status(404).json({ success: false, message: 'Supplier not found' });
        return;
      }

      // Get declarations for this supplier
      const declarations = await SupplierDeclaration.find({ supplier: supplier._id })
        .populate('reportingPeriod', 'year quarter')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: {
          ...supplier.toObject(),
          declarations
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch supplier' });
    }
  }
);

// @route   POST /api/suppliers
// @desc    Create new supplier
// @access  Private (Admin, Manager)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  [
    body('name').trim().notEmpty().withMessage('Supplier name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('contactPerson').optional().trim(),
    body('phone').optional().trim(),
    body('address.country').trim().notEmpty().withMessage('Country is required'),
    body('address.countryCode').isLength({ min: 2, max: 2 }).withMessage('Country code must be 2 characters')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const orgId = req.user?.organisation;

      // Check for duplicate
      const existing = await Supplier.findOne({
        organisation: orgId,
        $or: [
          { name: req.body.name },
          { email: req.body.email }
        ]
      });

      if (existing) {
        res.status(400).json({
          success: false,
          message: 'A supplier with this name or email already exists'
        });
        return;
      }

      const supplier = await Supplier.create({
        ...req.body,
        organisation: orgId,
        status: SupplierStatus.ACTIVE
      });

      res.status(201).json({
        success: true,
        message: 'Supplier created successfully',
        data: supplier
      });
    } catch (error) {
      console.error('Create supplier error:', error);
      res.status(500).json({ success: false, message: 'Failed to create supplier' });
    }
  }
);

// @route   PUT /api/suppliers/:id
// @desc    Update supplier
// @access  Private (Admin, Manager)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  [
    param('id').isMongoId(),
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail(),
    body('status').optional().isIn(Object.values(SupplierStatus))
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const supplier = await Supplier.findOneAndUpdate(
        { _id: req.params.id, organisation: req.user?.organisation },
        { $set: req.body },
        { new: true, runValidators: true }
      );

      if (!supplier) {
        res.status(404).json({ success: false, message: 'Supplier not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Supplier updated successfully',
        data: supplier
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update supplier' });
    }
  }
);

// @route   POST /api/suppliers/:id/invite
// @desc    Send invitation to supplier
// @access  Private (Admin, Manager)
router.post(
  '/:id/invite',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const supplier = await Supplier.findOne({
        _id: req.params.id,
        organisation: req.user?.organisation
      });

      if (!supplier) {
        res.status(404).json({ success: false, message: 'Supplier not found' });
        return;
      }

      // Generate invitation token
      const token = crypto.randomBytes(32).toString('hex');
      
      supplier.invitationToken = token;
      supplier.invitationSentAt = new Date();
      supplier.status = SupplierStatus.PENDING;
      await supplier.save();

      // In production, send email here
      // For now, return the token
      const inviteUrl = `${process.env.FRONTEND_URL}/supplier-portal?token=${token}`;

      res.json({
        success: true,
        message: 'Invitation sent successfully',
        data: {
          email: supplier.email,
          inviteUrl // Remove in production
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to send invitation' });
    }
  }
);

// @route   DELETE /api/suppliers/:id
// @desc    Delete supplier (soft delete)
// @access  Private (Admin)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const supplier = await Supplier.findOneAndUpdate(
        { _id: req.params.id, organisation: req.user?.organisation },
        { status: SupplierStatus.INACTIVE },
        { new: true }
      );

      if (!supplier) {
        res.status(404).json({ success: false, message: 'Supplier not found' });
        return;
      }

      res.json({ success: true, message: 'Supplier deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to delete supplier' });
    }
  }
);

// ==================== DECLARATIONS ====================

// @route   GET /api/suppliers/declarations
// @desc    Get all declarations
// @access  Private
router.get('/declarations/all', async (req: AuthRequest, res: Response) => {
  try {
    const { status, supplier, reportingPeriod } = req.query;
    const orgId = req.user?.organisation;

    const filter: Record<string, unknown> = { organisation: orgId };
    if (status) filter.status = status;
    if (supplier) filter.supplier = supplier;
    if (reportingPeriod) filter.reportingPeriod = reportingPeriod;

    const declarations = await SupplierDeclaration.find(filter)
      .populate('supplier', 'name email')
      .populate('reportingPeriod', 'year quarter')
      .populate('verifiedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: declarations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch declarations' });
  }
});

// @route   POST /api/suppliers/:id/declarations
// @desc    Create declaration for supplier
// @access  Private (Admin, Manager, Operator)
router.post(
  '/:id/declarations',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR),
  [
    param('id').isMongoId(),
    body('reportingPeriod').isMongoId(),
    body('productName').trim().notEmpty(),
    body('directEmissionFactor').isFloat({ min: 0 }),
    body('indirectEmissionFactor').isFloat({ min: 0 })
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const supplier = await Supplier.findOne({
        _id: req.params.id,
        organisation: req.user?.organisation
      });

      if (!supplier) {
        res.status(404).json({ success: false, message: 'Supplier not found' });
        return;
      }

      const declaration = await SupplierDeclaration.create({
        ...req.body,
        organisation: req.user?.organisation,
        supplier: supplier._id,
        status: DeclarationStatus.PENDING
      });

      // Update supplier's last declaration date
      supplier.lastDeclarationAt = new Date();
      await supplier.save();

      res.status(201).json({
        success: true,
        message: 'Declaration created successfully',
        data: declaration
      });
    } catch (error) {
      console.error('Create declaration error:', error);
      res.status(500).json({ success: false, message: 'Failed to create declaration' });
    }
  }
);

// @route   PUT /api/suppliers/declarations/:id/verify
// @desc    Verify or reject declaration
// @access  Private (Admin, Manager)
router.put(
  '/declarations/:id/verify',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  [
    param('id').isMongoId(),
    body('status').isIn([DeclarationStatus.VERIFIED, DeclarationStatus.REJECTED]),
    body('rejectionReason').optional().trim()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { status, rejectionReason } = req.body;

      const updateData: Record<string, unknown> = {
        status,
        verifiedBy: req.user?._id,
        verifiedAt: new Date()
      };

      if (status === DeclarationStatus.REJECTED && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }

      const declaration = await SupplierDeclaration.findOneAndUpdate(
        { _id: req.params.id, organisation: req.user?.organisation },
        { $set: updateData },
        { new: true }
      ).populate('supplier', 'name');

      if (!declaration) {
        res.status(404).json({ success: false, message: 'Declaration not found' });
        return;
      }

      res.json({
        success: true,
        message: `Declaration ${status === DeclarationStatus.VERIFIED ? 'verified' : 'rejected'} successfully`,
        data: declaration
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update declaration' });
    }
  }
);

// @route   DELETE /api/suppliers/declarations/:id
// @desc    Delete declaration
// @access  Private (Admin)
router.delete(
  '/declarations/:id',
  authorize(UserRole.ADMIN),
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const declaration = await SupplierDeclaration.findOneAndDelete({
        _id: req.params.id,
        organisation: req.user?.organisation
      });

      if (!declaration) {
        res.status(404).json({ success: false, message: 'Declaration not found' });
        return;
      }

      res.json({ success: true, message: 'Declaration deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to delete declaration' });
    }
  }
);

export default router;

