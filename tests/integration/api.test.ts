import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCustomers,
  getTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  createCustomer,
  getAuthHeader,
} from '../../client/src/lib/api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-jwt-token');
  });

  describe('getAuthHeader', () => {
    it('returns auth header with token from localStorage', () => {
      const header = getAuthHeader();
      expect(header).toEqual({ Authorization: 'Bearer mock-jwt-token' });
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('token');
    });

    it('returns empty object when no token', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      const header = getAuthHeader();
      expect(header).toEqual({});
    });
  });

  describe('getCustomers', () => {
    it('fetches customers successfully', async () => {
      const mockCustomers = [
        { id: 1, name: 'Customer 1', weeklyGoalHours: 40 },
        { id: 2, name: 'Customer 2', weeklyGoalHours: 30 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomers,
      });

      const result = await getCustomers();
      
      expect(result).toEqual(mockCustomers);
      expect(mockFetch).toHaveBeenCalledWith('/api/customers', {
        headers: { Authorization: 'Bearer mock-jwt-token' },
      });
    });

    it('throws error on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(getCustomers()).rejects.toThrow('Failed to fetch customers');
    });
  });

  describe('getTimeEntries', () => {
    it('fetches time entries successfully', async () => {
      const mockEntries = [
        {
          id: 1,
          checkIn: '2024-01-01T09:00:00Z',
          checkOut: '2024-01-01T17:00:00Z',
          isBreak: false,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEntries,
      });

      const result = await getTimeEntries();
      
      expect(result).toEqual(mockEntries);
      expect(mockFetch).toHaveBeenCalledWith('/api/time-entries', {
        headers: { Authorization: 'Bearer mock-jwt-token' },
      });
    });
  });

  describe('createTimeEntry', () => {
    it('creates work time entry successfully', async () => {
      const entryData = { isBreak: false, customerId: 1 };
      const mockCreatedEntry = {
        id: 1,
        ...entryData,
        checkIn: '2024-01-01T09:00:00Z',
        checkOut: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedEntry,
      });

      const result = await createTimeEntry(entryData);
      
      expect(result).toEqual(mockCreatedEntry);
      expect(mockFetch).toHaveBeenCalledWith('/api/time-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-token',
        },
        body: JSON.stringify(entryData),
      });
    });

    it('creates break entry successfully', async () => {
      const entryData = { isBreak: true };
      const mockCreatedEntry = {
        id: 2,
        isBreak: true,
        checkIn: '2024-01-01T12:00:00Z',
        checkOut: null,
        customerId: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedEntry,
      });

      const result = await createTimeEntry(entryData);
      expect(result).toEqual(mockCreatedEntry);
    });
  });

  describe('updateTimeEntry', () => {
    it('updates time entry successfully', async () => {
      const updateData = { id: 1, checkOut: '2024-01-01T17:00:00Z' };
      const mockUpdatedEntry = {
        id: 1,
        checkIn: '2024-01-01T09:00:00Z',
        checkOut: '2024-01-01T17:00:00Z',
        isBreak: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdatedEntry,
      });

      const result = await updateTimeEntry(updateData);
      
      expect(result).toEqual(mockUpdatedEntry);
      expect(mockFetch).toHaveBeenCalledWith('/api/time-entries/1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-token',
        },
        body: JSON.stringify({ checkOut: updateData.checkOut }),
      });
    });
  });

  describe('createCustomer', () => {
    it('creates customer successfully', async () => {
      const customerData = {
        name: 'New Customer',
        weeklyGoalHours: 40,
        billingAddress: '123 Main St',
        billingEmail: 'billing@customer.com',
      };
      
      const mockCreatedCustomer = {
        id: 3,
        ...customerData,
        userId: 1,
        createdAt: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedCustomer,
      });

      const result = await createCustomer(customerData);
      
      expect(result).toEqual(mockCreatedCustomer);
      expect(mockFetch).toHaveBeenCalledWith('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-token',
        },
        body: JSON.stringify(customerData),
      });
    });

    it('throws error on validation failure', async () => {
      const invalidCustomerData = { name: '' }; // Invalid data

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Validation failed' }),
      });

      await expect(createCustomer(invalidCustomerData)).rejects.toThrow('Failed to create customer');
    });
  });

  describe('Error Handling', () => {
    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(getCustomers()).rejects.toThrow('Network error');
    });

    it('handles unauthorized access', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(getCustomers()).rejects.toThrow('Failed to fetch customers');
    });

    it('handles server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(getTimeEntries()).rejects.toThrow('Failed to fetch time entries');
    });
  });
});