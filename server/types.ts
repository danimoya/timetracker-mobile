import { Request } from 'express';
import { User } from '../db/schema';

export interface AuthenticatedRequest extends Request {
  user: User[];
}

export interface TimeEntryRequest {
  isBreak: boolean;
  customerId?: number;
  notes?: string;
}

export interface CustomerRequest {
  name: string;
  weeklyGoalHours?: number;
  billingAddress?: string;
  billingEmail?: string;
}

export interface InvoiceRequest {
  customerId: number;
  month: number;
  year: number;
}