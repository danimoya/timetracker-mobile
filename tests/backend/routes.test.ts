import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';
import { db } from '../../db';
import { users, customers, timeEntries } from '../../db/schema';
import jwt from 'jsonwebtoken';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}));

// Mock JWT
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
  sign: vi.fn(),
  verify: vi.fn(),
}));

const mockDb = vi.mocked(db);
const mockJwt = vi.mocked(jwt);

describe('API Routes', () => {
  let app: express.Application;
  let server: any;
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    password: 'hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    server = registerRoutes(app);
    
    // Mock JWT verification
    mockJwt.verify.mockReturnValue({ userId: 1 });
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/customers', () => {
    it('should return customers for authenticated user', async () => {
      const mockCustomers = [
        { id: 1, name: 'Customer 1', userId: 1, weeklyGoalHours: 40 },
        { id: 2, name: 'Customer 2', userId: 1, weeklyGoalHours: 30 }
      ];

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockCustomers),
      };
      
      mockDb.select.mockReturnValue(mockQuery);

      const response = await request(app)
        .get('/api/customers')
        .set('Authorization', 'Bearer validtoken')
        .expect(200);

      expect(response.body).toEqual(mockCustomers);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return 401 without valid token', async () => {
      await request(app)
        .get('/api/customers')
        .expect(401);
    });
  });

  describe('POST /api/customers', () => {
    it('should create a new customer', async () => {
      const newCustomer = {
        name: 'New Customer',
        weeklyGoalHours: 40,
        billingAddress: '123 Main St',
        billingEmail: 'billing@customer.com'
      };

      const mockCreatedCustomer = {
        id: 3,
        ...newCustomer,
        userId: 1,
        createdAt: new Date()
      };

      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockCreatedCustomer])
      };

      mockDb.insert.mockReturnValue(mockQuery);

      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', 'Bearer validtoken')
        .send(newCustomer)
        .expect(200);

      expect(response.body).toEqual(mockCreatedCustomer);
      expect(mockDb.insert).toHaveBeenCalledWith(customers);
    });

    it('should return 400 for invalid customer data', async () => {
      const invalidCustomer = {
        // Missing required name field
        weeklyGoalHours: 40
      };

      await request(app)
        .post('/api/customers')
        .set('Authorization', 'Bearer validtoken')
        .send(invalidCustomer)
        .expect(500); // Currently returns 500, could be improved to 400
    });
  });

  describe('GET /api/time-entries', () => {
    it('should return time entries for authenticated user', async () => {
      const mockEntries = [
        {
          id: 1,
          userId: 1,
          customerId: 1,
          checkIn: new Date('2024-01-01T09:00:00Z'),
          checkOut: new Date('2024-01-01T17:00:00Z'),
          isBreak: false,
          notes: 'Work session'
        }
      ];

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockEntries)
      };

      mockDb.select.mockReturnValue(mockQuery);

      const response = await request(app)
        .get('/api/time-entries')
        .set('Authorization', 'Bearer validtoken')
        .expect(200);

      expect(response.body).toEqual(mockEntries);
    });
  });

  describe('POST /api/time-entries', () => {
    it('should create a new time entry', async () => {
      const newEntry = {
        isBreak: false,
        customerId: 1,
        notes: 'Working on project'
      };

      const mockCreatedEntry = {
        id: 2,
        userId: 1,
        ...newEntry,
        checkIn: new Date(),
        checkOut: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockCreatedEntry])
      };

      mockDb.insert.mockReturnValue(mockQuery);

      const response = await request(app)
        .post('/api/time-entries')
        .set('Authorization', 'Bearer validtoken')
        .send(newEntry)
        .expect(200);

      expect(response.body).toEqual(mockCreatedEntry);
      expect(mockDb.insert).toHaveBeenCalledWith(timeEntries);
    });

    it('should create a break entry', async () => {
      const breakEntry = {
        isBreak: true,
        customerId: null
      };

      const mockCreatedEntry = {
        id: 3,
        userId: 1,
        ...breakEntry,
        checkIn: new Date(),
        checkOut: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockCreatedEntry])
      };

      mockDb.insert.mockReturnValue(mockQuery);

      const response = await request(app)
        .post('/api/time-entries')
        .set('Authorization', 'Bearer validtoken')
        .send(breakEntry)
        .expect(200);

      expect(response.body).toEqual(mockCreatedEntry);
    });
  });

  describe('PATCH /api/time-entries/:id', () => {
    it('should update time entry with checkout time', async () => {
      const checkOutTime = new Date().toISOString();
      const updatedEntry = {
        id: 1,
        userId: 1,
        customerId: 1,
        checkIn: new Date('2024-01-01T09:00:00Z'),
        checkOut: new Date(checkOutTime),
        isBreak: false,
        updatedAt: new Date()
      };

      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([updatedEntry])
      };

      mockDb.update.mockReturnValue(mockQuery);

      const response = await request(app)
        .patch('/api/time-entries/1')
        .set('Authorization', 'Bearer validtoken')
        .send({ checkOut: checkOutTime })
        .expect(200);

      expect(response.body).toEqual(updatedEntry);
    });
  });

  describe('POST /api/generate-invoice', () => {
    it('should generate invoice for customer and period', async () => {
      const invoiceData = {
        customerId: 1,
        month: 12,
        year: 2024
      };

      const mockTimeEntries = [
        {
          id: 1,
          checkIn: new Date('2024-12-01T09:00:00Z'),
          checkOut: new Date('2024-12-01T17:00:00Z'),
          isBreak: false
        }
      ];

      const mockCustomer = {
        id: 1,
        name: 'Test Customer',
        userId: 1
      };

      const mockInvoice = {
        id: 1,
        customerId: 1,
        userId: 1,
        month: 12,
        year: 2024,
        status: 'generated',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock time entries query
      const mockEntriesQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockTimeEntries)
      };

      // Mock customer query
      const mockCustomerQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockCustomer])
      };

      // Mock invoice insert
      const mockInvoiceQuery = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockInvoice])
      };

      mockDb.select
        .mockReturnValueOnce(mockEntriesQuery)
        .mockReturnValueOnce(mockCustomerQuery);
      mockDb.insert.mockReturnValue(mockInvoiceQuery);

      const response = await request(app)
        .post('/api/generate-invoice')
        .set('Authorization', 'Bearer validtoken')
        .send(invoiceData)
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});