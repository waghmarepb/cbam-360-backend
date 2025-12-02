import request from 'supertest';
import express from 'express';
import productRoutes from '../../src/routes/products';
import Product from '../../src/models/Product';
import { createTestUser } from '../helpers/testUtils';
import { authenticate } from '../../src/middleware/auth';

// Create express app for testing
const app = express();
app.use(express.json());

// Mock authentication middleware for testing
app.use((req, res, next) => {
  // Will be set in tests
  next();
});

app.use('/api/products', productRoutes);

describe('Product Routes', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    testUser = await createTestUser();
  });

  describe('GET /api/products', () => {
    it('should return empty array when no products exist', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return products for authenticated user', async () => {
      // Create test products
      await Product.create({
        name: 'Test Product 1',
        cnCode: '72131000',
        organisation: testUser.organisation._id,
        unit: 'tonnes',
        isActive: true
      });

      await Product.create({
        name: 'Test Product 2',
        cnCode: '72139110',
        organisation: testUser.organisation._id,
        unit: 'tonnes',
        isActive: true
      });

      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should not return products from other organisations', async () => {
      // Create product for different organisation
      const otherUser = await createTestUser({ email: 'other@test.com' });
      
      await Product.create({
        name: 'Other Org Product',
        cnCode: '72131000',
        organisation: otherUser.organisation._id,
        unit: 'tonnes',
        isActive: true
      });

      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('POST /api/products', () => {
    it('should create a new product', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          name: 'New Steel Product',
          cnCode: '72139110',
          description: 'Hot-rolled steel wire rod',
          unit: 'tonnes'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Steel Product');
      expect(response.body.data.cnCode).toBe('72139110');

      // Verify in database
      const product = await Product.findById(response.body.data._id);
      expect(product).toBeTruthy();
      expect(product?.name).toBe('New Steel Product');
    });

    it('should reject product with invalid CN code format', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          name: 'Invalid Product',
          cnCode: '123', // Should be 8 digits
          unit: 'tonnes'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject duplicate product name', async () => {
      // Create first product
      await Product.create({
        name: 'Duplicate Product',
        cnCode: '72131000',
        organisation: testUser.organisation._id,
        unit: 'tonnes',
        isActive: true
      });

      // Try to create duplicate
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          name: 'Duplicate Product',
          cnCode: '72139110',
          unit: 'tonnes'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          description: 'Missing name and CN code'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/products/:id', () => {
    it('should update an existing product', async () => {
      const product = await Product.create({
        name: 'Original Name',
        cnCode: '72131000',
        organisation: testUser.organisation._id,
        unit: 'tonnes',
        isActive: true
      });

      const response = await request(app)
        .put(`/api/products/${product._id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          name: 'Updated Name',
          description: 'Updated description'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');

      // Verify in database
      const updated = await Product.findById(product._id);
      expect(updated?.name).toBe('Updated Name');
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .put(`/api/products/${fakeId}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          name: 'Updated Name'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('should soft-delete a product', async () => {
      const product = await Product.create({
        name: 'To Delete',
        cnCode: '72131000',
        organisation: testUser.organisation._id,
        unit: 'tonnes',
        isActive: true
      });

      const response = await request(app)
        .delete(`/api/products/${product._id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify soft delete
      const deleted = await Product.findById(product._id);
      expect(deleted?.isActive).toBe(false);
    });
  });
});

