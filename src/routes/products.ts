import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import multer from 'multer';
import * as XLSX from 'xlsx';
import Product, { ProductUnit } from '../models/Product';
import CNCode from '../models/CNCode';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
router.use(authenticate);

// @route   GET /api/products
// @desc    Get all products for current organisation
// @access  Private
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, search, cnCode, isActive } = req.query;
    const orgId = req.user?.organisation;

    const filter: Record<string, unknown> = { organisation: orgId };

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    } else {
      filter.isActive = true;
    }

    if (cnCode) {
      filter.cnCode = cnCode;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { productCode: { $regex: search, $options: 'i' } },
        { cnCode: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('cnCodeRef', 'description category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products'
    });
  }
});

// @route   GET /api/products/:id
// @desc    Get product by ID
// @access  Private
router.get(
  '/:id',
  param('id').isMongoId().withMessage('Invalid product ID'),
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array()
        });
        return;
      }

      const product = await Product.findOne({
        _id: req.params.id,
        organisation: req.user?.organisation
      }).populate('cnCodeRef');

      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Product not found'
        });
        return;
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      console.error('Get product error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch product'
      });
    }
  }
);

// @route   POST /api/products
// @desc    Create new product
// @access  Private (Admin, Manager, Operator)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR),
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('productCode').optional().trim(),
    body('cnCode').matches(/^\d{8}$/).withMessage('CN code must be 8 digits'),
    body('description').optional().trim(),
    body('unit').optional().isIn(Object.values(ProductUnit))
  ],
  async (req: AuthRequest, res: Response) => {
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

      const { cnCode } = req.body;
      const orgId = req.user?.organisation;

      // Check if CN code exists in master data
      const cnCodeDoc = await CNCode.findOne({ code: cnCode });
      
      // Check for duplicate product name
      const existing = await Product.findOne({
        organisation: orgId,
        name: req.body.name
      });

      if (existing) {
        res.status(400).json({
          success: false,
          message: 'A product with this name already exists'
        });
        return;
      }

      const product = await Product.create({
        ...req.body,
        organisation: orgId,
        cnCodeRef: cnCodeDoc?._id
      });

      const populatedProduct = await Product.findById(product._id)
        .populate('cnCodeRef', 'description category');

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: populatedProduct,
        warning: !cnCodeDoc ? 'CN code not found in CBAM registry' : undefined
      });
    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create product'
      });
    }
  }
);

// @route   POST /api/products/import
// @desc    Import products from Excel/CSV
// @access  Private (Admin, Manager)
router.post(
  '/import',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
        return;
      }

      const orgId = req.user?.organisation;
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

      if (data.length === 0) {
        res.status(400).json({
          success: false,
          message: 'File is empty'
        });
        return;
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as { row: number; error: string }[]
      };

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          const name = String(row['name'] || row['Name'] || row['Product Name'] || '').trim();
          const cnCode = String(row['cnCode'] || row['CN Code'] || row['cn_code'] || '').trim();
          const productCode = String(row['productCode'] || row['Product Code'] || row['code'] || '').trim();
          const unit = String(row['unit'] || row['Unit'] || 'tonnes').toLowerCase();

          if (!name || !cnCode) {
            results.failed++;
            results.errors.push({ row: i + 2, error: 'Missing name or CN code' });
            continue;
          }

          if (!/^\d{8}$/.test(cnCode)) {
            results.failed++;
            results.errors.push({ row: i + 2, error: `Invalid CN code format: ${cnCode}` });
            continue;
          }

          // Check for existing product
          const existing = await Product.findOne({ organisation: orgId, name });
          if (existing) {
            results.failed++;
            results.errors.push({ row: i + 2, error: `Product "${name}" already exists` });
            continue;
          }

          const cnCodeDoc = await CNCode.findOne({ code: cnCode });

          await Product.create({
            organisation: orgId,
            name,
            productCode: productCode || undefined,
            cnCode,
            cnCodeRef: cnCodeDoc?._id,
            unit: Object.values(ProductUnit).includes(unit as ProductUnit) 
              ? unit 
              : ProductUnit.TONNES
          });

          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push({ row: i + 2, error: 'Failed to create product' });
        }
      }

      res.json({
        success: true,
        message: `Import completed: ${results.success} success, ${results.failed} failed`,
        data: results
      });
    } catch (error) {
      console.error('Import products error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to import products'
      });
    }
  }
);

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private (Admin, Manager, Operator)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR),
  [
    param('id').isMongoId().withMessage('Invalid product ID'),
    body('name').optional().trim().notEmpty(),
    body('productCode').optional().trim(),
    body('cnCode').optional().matches(/^\d{8}$/),
    body('description').optional().trim(),
    body('unit').optional().isIn(Object.values(ProductUnit))
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array()
        });
        return;
      }

      const updateData = { ...req.body };

      // If CN code is being updated, update the reference too
      if (req.body.cnCode) {
        const cnCodeDoc = await CNCode.findOne({ code: req.body.cnCode });
        updateData.cnCodeRef = cnCodeDoc?._id || null;
      }

      const product = await Product.findOneAndUpdate(
        { _id: req.params.id, organisation: req.user?.organisation },
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate('cnCodeRef', 'description category');

      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Product not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Product updated successfully',
        data: product
      });
    } catch (error) {
      console.error('Update product error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update product'
      });
    }
  }
);

// @route   DELETE /api/products/:id
// @desc    Delete (deactivate) product
// @access  Private (Admin, Manager)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  param('id').isMongoId().withMessage('Invalid product ID'),
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array()
        });
        return;
      }

      const product = await Product.findOneAndUpdate(
        { _id: req.params.id, organisation: req.user?.organisation },
        { isActive: false },
        { new: true }
      );

      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Product not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      console.error('Delete product error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete product'
      });
    }
  }
);

export default router;

