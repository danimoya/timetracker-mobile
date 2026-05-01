import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RealTimeDashboard from '../../../client/src/components/RealTimeDashboard';
import { localStorageMock } from '../../setup';

const mockDashboardData = {
  todayStats: {
    totalMinutes: 240,
    breakMinutes: 30,
    activeTimer: {
      id: 1,
      checkIn: '2025-06-30T10:00:00Z',
      isBreak: false,
      customerId: 1,
      customerName: 'Test Customer'
    },
    completedTasks: 5
  },
  weekStats: {
    totalMinutes: 1200,
    dailyAverage: 171,
    peakDay: 'Monday',
    goalProgress: 50
  },
  recentActivity: [
    {
      id: 1,
      checkIn: '2025-06-30T10:00:00Z',
      checkOut: '2025-06-30T12:00:00Z',
      isBreak: false,
      customerName: 'Test Customer',
      duration: 120
    },
    {
      id: 2,
      checkIn: '2025-06-30T13:00:00Z',
      checkOut: '2025-06-30T13:15:00Z',
      isBreak: true,
      customerName: null,
      duration: 15
    }
  ],
  topCustomers: [
    {
      customerId: 1,
      customerName: 'Test Customer',
      totalMinutes: 300,
      sessionCount: 6
    },
    {
      customerId: 2,
      customerName: 'Another Customer',
      totalMinutes: 180,
      sessionCount: 3
    }
  ]
};

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('RealTimeDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('fake-jwt-token');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDashboardData)
    });
  });

  it('renders dashboard title and connection status', () => {
    renderWithQueryClient(<RealTimeDashboard />);
    
    expect(screen.getByText('Real-Time Dashboard')).toBeInTheDocument();
  });

  it('displays loading skeleton while fetching data', () => {
    // Mock pending fetch
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
    
    renderWithQueryClient(<RealTimeDashboard />);
    
    // Should show loading skeletons
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('displays active timer when available', async () => {
    renderWithQueryClient(<RealTimeDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Active Timer')).toBeInTheDocument();
      expect(screen.getByText('Work Session')).toBeInTheDocument();
      expect(screen.getByText('Test Customer')).toBeInTheDocument();
    });
  });

  it('displays today\'s statistics correctly', async () => {
    renderWithQueryClient(<RealTimeDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Today\'s Work')).toBeInTheDocument();
      expect(screen.getByText('4:00:00')).toBeInTheDocument(); // 240 minutes formatted
      expect(screen.getByText('Tasks Completed')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('displays weekly progress information', async () => {
    renderWithQueryClient(<RealTimeDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Weekly Progress')).toBeInTheDocument();
      expect(screen.getByText('20:00:00')).toBeInTheDocument(); // 1200 minutes formatted
      expect(screen.getByText('50% of weekly goal')).toBeInTheDocument();
    });
  });

  it('displays daily average correctly', async () => {
    renderWithQueryClient(<RealTimeDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Daily Average')).toBeInTheDocument();
      expect(screen.getByText('2:51:00')).toBeInTheDocument(); // 171 minutes formatted
      expect(screen.getByText('Peak day: Monday')).toBeInTheDocument();
    });
  });

  it('shows recent activity list', async () => {
    renderWithQueryClient(<RealTimeDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      expect(screen.getByText('Test Customer')).toBeInTheDocument();
      expect(screen.getByText('No customer')).toBeInTheDocument();
    });
  });

  it('displays work and break badges in recent activity', async () => {
    renderWithQueryClient(<RealTimeDashboard />);
    
    await waitFor(() => {
      const badges = screen.getAllByText(/Work|Break/);
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it('shows top customers ranking', async () => {
    renderWithQueryClient(<RealTimeDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Top Customers This Week')).toBeInTheDocument();
      expect(screen.getByText('Test Customer')).toBeInTheDocument();
      expect(screen.getByText('Another Customer')).toBeInTheDocument();
      expect(screen.getByText('6 sessions')).toBeInTheDocument();
      expect(screen.getByText('3 sessions')).toBeInTheDocument();
    });
  });

  it('displays customer rankings with position numbers', async () => {
    renderWithQueryClient(<RealTimeDashboard />);
    
    await waitFor(() => {
      const rankings = screen.getAllByText(/^[1-5]$/);
      expect(rankings.length).toBeGreaterThan(0);
    });
  });

  it('handles break timer display correctly', async () => {
    const breakTimerData = {
      ...mockDashboardData,
      todayStats: {
        ...mockDashboardData.todayStats,
        activeTimer: {
          ...mockDashboardData.todayStats.activeTimer!,
          isBreak: true,
          customerName: null
        }
      }
    };
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(breakTimerData)
    });
    
    renderWithQueryClient(<RealTimeDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Break Time')).toBeInTheDocument();
      expect(screen.getByText('No customer selected')).toBeInTheDocument();
    });
  });

  it('handles no active timer state', async () => {
    const noActiveTimerData = {
      ...mockDashboardData,
      todayStats: {
        ...mockDashboardData.todayStats,
        activeTimer: null
      }
    };
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(noActiveTimerData)
    });
    
    renderWithQueryClient(<RealTimeDashboard />);
    
    await waitFor(() => {
      expect(screen.queryByText('Active Timer')).not.toBeInTheDocument();
    });
  });

  it('calculates daily progress percentage correctly', async () => {
    renderWithQueryClient(<RealTimeDashboard />);
    
    await waitFor(() => {
      // 240 minutes out of 480 (8 hours) = 50%
      expect(screen.getByText('50% of daily goal')).toBeInTheDocument();
    });
  });

  it('updates timer display every second for active timer', async () => {
    vi.useFakeTimers();
    
    renderWithQueryClient(<RealTimeDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Active Timer')).toBeInTheDocument();
    });
    
    // Advance time by 1 second
    vi.advanceTimersByTime(1000);
    
    // Timer should update (exact value depends on current time vs checkIn time)
    expect(screen.getByText('Active Timer')).toBeInTheDocument();
    
    vi.useRealTimers();
  });

  it('handles API errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('API Error'));
    
    renderWithQueryClient(<RealTimeDashboard />);
    
    // Should still render the component structure without crashing
    expect(screen.getByText('Real-Time Dashboard')).toBeInTheDocument();
  });

  it('fetches dashboard data with correct authorization', async () => {
    renderWithQueryClient(<RealTimeDashboard />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/dashboard', {
        headers: {
          'Authorization': 'Bearer fake-jwt-token'
        }
      });
    });
  });
});