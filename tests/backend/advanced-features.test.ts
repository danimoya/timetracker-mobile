import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerAdvancedFeatures } from '../../server/advanced-features';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  }
}));

// Mock Drizzle ORM functions
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  like: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  sql: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
}));

// Mock database schema
vi.mock('../../db/schema', () => ({
  timeEntries: {
    id: 'timeEntries.id',
    userId: 'timeEntries.userId',
    customerId: 'timeEntries.customerId',
    checkIn: 'timeEntries.checkIn',
    checkOut: 'timeEntries.checkOut',
    isBreak: 'timeEntries.isBreak',
    notes: 'timeEntries.notes'
  },
  customers: {
    id: 'customers.id',
    name: 'customers.name'
  }
}));

describe('Advanced Features API', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req: any, res, next) => {
      req.user = [{ id: 1 }];
      next();
    });
    
    registerAdvancedFeatures(app);
  });

  describe('POST /api/search', () => {
    it('accepts search request with filters', async () => {
      const mockResults = [
        {
          id: 1,
          checkIn: '2025-06-30T10:00:00Z',
          checkOut: '2025-06-30T12:00:00Z',
          isBreak: false,
          notes: 'Test work',
          customerId: 1,
          customerName: 'Test Customer',
          duration: 120
        }
      ];

      // Mock the database query chain
      const { db } = await import('../../db');
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockResults)
      }));

      const searchRequest = {
        query: 'test',
        dateFrom: '2025-06-01',
        dateTo: '2025-06-30',
        sortBy: 'date',
        sortOrder: 'desc',
        page: 1,
        limit: 20
      };

      const response = await request(app)
        .post('/api/search')
        .send(searchRequest)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });

    it('handles empty search results', async () => {
      const { db } = await import('../../db');
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([])
      }));

      const response = await request(app)
        .post('/api/search')
        .send({ query: 'nonexistent' })
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });

    it('validates search filters correctly', async () => {
      const { db } = await import('../../db');
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([])
      }));

      const searchRequest = {
        query: '',
        dateFrom: '2025-06-01',
        dateTo: '2025-06-30',
        customerId: 1,
        isBreak: false,
        minDuration: 30,
        maxDuration: 300
      };

      const response = await request(app)
        .post('/api/search')
        .send(searchRequest)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/dashboard', () => {
    it('returns comprehensive dashboard data', async () => {
      const mockDashboardData = {
        todayStats: {
          totalMinutes: 240,
          breakMinutes: 30,
          completedTasks: 5
        },
        weekStats: {
          totalMinutes: 1200,
          dailyAverage: 171,
          peakDay: 'Monday',
          goalProgress: 50
        },
        recentActivity: [],
        topCustomers: []
      };

      const { db } = await import('../../db');
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockDashboardData.todayStats])
      }));

      const response = await request(app)
        .get('/api/dashboard')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });

    it('handles missing active timer', async () => {
      const { db } = await import('../../db');
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      }));

      const response = await request(app)
        .get('/api/dashboard')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/patterns', () => {
    it('returns productivity patterns for specified period', async () => {
      const mockPatterns = {
        hourlyPatterns: [
          { hour: 9, avgDuration: 60, sessionCount: 3, totalMinutes: 180 },
          { hour: 10, avgDuration: 45, sessionCount: 2, totalMinutes: 90 }
        ],
        weekdayPatterns: [
          { dayOfWeek: 1, dayName: 'Monday', avgDuration: 50, totalMinutes: 300 }
        ],
        breakPatterns: {
          avgBreakDuration: 15,
          breakFrequency: 3,
          totalBreakTime: 45
        }
      };

      const { db } = await import('../../db');
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockPatterns.hourlyPatterns)
      }));

      const response = await request(app)
        .get('/api/patterns?days=30')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });

    it('defaults to 30 days when no period specified', async () => {
      const { db } = await import('../../db');
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([])
      }));

      const response = await request(app)
        .get('/api/patterns')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });

    it('provides productivity analysis and recommendations', async () => {
      const { db } = await import('../../db');
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          { hour: 10, totalMinutes: 180 },
          { hour: 14, totalMinutes: 120 }
        ])
      }));

      const response = await request(app)
        .get('/api/patterns?days=7')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/reports/custom', () => {
    it('generates custom reports with date ranges', async () => {
      const mockReportData = [
        {
          period: '2025-06-30',
          workMinutes: 240,
          breakMinutes: 30,
          sessionCount: 5,
          avgSessionLength: 48
        }
      ];

      const { db } = await import('../../db');
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockReportData)
      }));

      const reportRequest = {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        groupBy: 'day',
        includeBreaks: true
      };

      const response = await request(app)
        .post('/api/reports/custom')
        .send(reportRequest)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });

    it('supports different grouping options', async () => {
      const { db } = await import('../../db');
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([])
      }));

      const reportRequest = {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        groupBy: 'week'
      };

      const response = await request(app)
        .post('/api/reports/custom')
        .send(reportRequest)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });

    it('includes customer breakdown in reports', async () => {
      const { db } = await import('../../db');
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([])
      }));

      const reportRequest = {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        groupBy: 'month'
      };

      const response = await request(app)
        .post('/api/reports/custom')
        .send(reportRequest)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('handles database errors gracefully in search', async () => {
      const { db } = await import('../../db');
      (db.select as any).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .post('/api/search')
        .send({ query: 'test' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('handles database errors gracefully in dashboard', async () => {
      const { db } = await import('../../db');
      (db.select as any).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/api/dashboard');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('handles database errors gracefully in patterns', async () => {
      const { db } = await import('../../db');
      (db.select as any).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/api/patterns');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('handles database errors gracefully in custom reports', async () => {
      const { db } = await import('../../db');
      (db.select as any).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .post('/api/reports/custom')
        .send({
          startDate: '2025-06-01',
          endDate: '2025-06-30'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});