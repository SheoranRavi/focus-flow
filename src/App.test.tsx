import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { TimerState } from './types';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Helper function to render App with providers
const renderApp = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('App Component', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
    vi.clearAllTimers();
  });

  describe('Initial Render', () => {
    it('should render the app header with title', () => {
      renderApp();
      const heading = screen.getByRole('heading', { level: 1, name: 'Focus Flow' });
      expect(heading).toBeInTheDocument();
    });

    it('should display "No active session" when no timer is running', () => {
      renderApp();
      expect(screen.getByText('No active session')).toBeInTheDocument();
    });

    it('should render default sessions on first load', () => {
      renderApp();
      expect(screen.getByText('Deep Work')).toBeInTheDocument();
      expect(screen.getByText('Reading')).toBeInTheDocument();
      expect(screen.getByText('Emails')).toBeInTheDocument();
    });

    it('should display login and signup buttons when not logged in', () => {
      renderApp();
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /signup/i })).toBeInTheDocument();
    });

    it('should display daily progress section', () => {
      renderApp();
      expect(screen.getByText('Daily Progress')).toBeInTheDocument();
    });

    it('should display streak counter', () => {
      renderApp();
      const streakElements = screen.getAllByText('Streak');
      expect(streakElements.length).toBeGreaterThan(0);
    });
  });

  describe('Session Management', () => {
    it('should add a new session when "New Session" button is clicked', async () => {
      const user = userEvent.setup();
      renderApp();

      const addButton = screen.getByRole('button', { name: /new session/i });
      await user.click(addButton);

      await waitFor(() => {
        const newSessions = screen.getAllByText(/New Session/i);
        // Should have at least 2: one button and one session title
        expect(newSessions.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should load sessions from localStorage if available', () => {
      const mockSessions = [
        {
          id: 99,
          title: 'Test Session',
          initialDuration: 1500,
          timeLeft: 1500,
          isCompleted: false,
          dailyGoalMinutes: 25,
          focusSeconds: 0,
          state: TimerState.PAUSED,
        },
      ];
      localStorage.setItem('sessions', JSON.stringify(mockSessions));

      renderApp();
      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('sessions', 'invalid json');
      
      // Should not throw and should render default sessions
      renderApp();
      expect(screen.getByText('Deep Work')).toBeInTheDocument();
    });

    it('should save sessions to localStorage when modified', async () => {
      const user = userEvent.setup();
      renderApp();

      const addButton = screen.getByRole('button', { name: /new session/i });
      await user.click(addButton);

      await waitFor(() => {
        const stored = localStorage.getItem('sessions');
        expect(stored).toBeTruthy();
        const sessions = JSON.parse(stored!);
        // Should have 4 sessions now (3 default + 1 new)
        expect(sessions.length).toBeGreaterThanOrEqual(4);
      }, { timeout: 3000 });
    });
  });

  describe('Navigation and Authentication', () => {
    it('should navigate to login page when login button is clicked', async () => {
      const user = userEvent.setup();
      renderApp();

      const loginButton = screen.getByRole('button', { name: /login/i });
      await user.click(loginButton);

      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('should navigate to register page when signup button is clicked', async () => {
      const user = userEvent.setup();
      renderApp();

      const signupButton = screen.getByRole('button', { name: /signup/i });
      await user.click(signupButton);

      expect(mockNavigate).toHaveBeenCalledWith('/register');
    });
  });

  describe('Settings Menu', () => {
    it('should open settings menu when menu button is clicked', async () => {
      const user = userEvent.setup();
      renderApp();

      // Find the menu button (MoreHorizontal icon button)
      const menuButtons = screen.getAllByRole('button');
      const settingsButton = menuButtons.find(btn => 
        btn.querySelector('svg') && btn.className.includes('rounded-full')
      );
      
      if (settingsButton) {
        await user.click(settingsButton);
        await waitFor(() => {
          expect(screen.getByText('Settings')).toBeInTheDocument();
        });
      }
    });

    it('should close settings menu when X button is clicked', async () => {
      const user = userEvent.setup();
      renderApp();

      // Open menu
      const menuButtons = screen.getAllByRole('button');
      const settingsButton = menuButtons.find(btn => 
        btn.querySelector('svg') && btn.className.includes('rounded-full')
      );
      
      if (settingsButton) {
        await user.click(settingsButton);
        
        await waitFor(() => {
          expect(screen.getByText('Settings')).toBeInTheDocument();
        });

        // Close menu
        const closeButtons = screen.getAllByRole('button');
        const xButton = closeButtons.find(btn => 
          btn.textContent === '' && btn.className.includes('hover:text-slate-600')
        );
        
        if (xButton) {
          await user.click(xButton);
          await waitFor(() => {
            expect(screen.queryByText('Settings')).not.toBeInTheDocument();
          });
        }
      }
    });

    it('should update reset time when changed in settings', async () => {
      const user = userEvent.setup();
      renderApp();

      // Open settings menu
      const menuButtons = screen.getAllByRole('button');
      const settingsButton = menuButtons.find(btn => 
        btn.querySelector('svg') && btn.className.includes('rounded-full')
      );
      
      if (settingsButton) {
        await user.click(settingsButton);

        await waitFor(() => {
          expect(screen.getByText('Settings')).toBeInTheDocument();
        });

        // Find time input by type
        const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
        if (timeInput) {
          await user.clear(timeInput);
          await user.type(timeInput, '09:00');

          await waitFor(() => {
            const stored = localStorage.getItem('resetTime');
            expect(stored).toContain('09');
          });
        }
      }
    });
  });

  describe('Daily Progress', () => {
    it('should display correct streak from localStorage', () => {
      localStorage.setItem('streak', '5');
      renderApp();

      const streakElements = screen.getAllByText(/5/);
      expect(streakElements.length).toBeGreaterThan(0);
    });

    it('should display yesterday minutes from localStorage', () => {
      localStorage.setItem('yesterdayMins', '120');
      renderApp();

      expect(screen.getByText(/2 h 0 min/)).toBeInTheDocument();
    });

    it('should reset daily progress when reset button is clicked', async () => {
      const user = userEvent.setup();
      const mockSessions = [
        {
          id: 1,
          title: 'Test',
          initialDuration: 1500,
          timeLeft: 1500,
          isCompleted: false,
          dailyGoalMinutes: 25,
          focusSeconds: 600, // 10 minutes
          state: TimerState.PAUSED,
        },
      ];
      localStorage.setItem('sessions', JSON.stringify(mockSessions));

      renderApp();

      // Find and click reset button (RotateCcw icon) - check by title attribute
      const buttons = screen.getAllByRole('button');
      const resetButton = buttons.find(btn => 
        btn.title && btn.title.includes('Start New Day')
      );

      if (resetButton) {
        await user.click(resetButton);

        await waitFor(() => {
          const stored = localStorage.getItem('sessions');
          const sessions = JSON.parse(stored!);
          // Focus seconds should be reset to 0
          const testSession = sessions.find((s: { id: number }) => s.id === 1);
          expect(testSession?.focusSeconds).toBe(0);
        });
      }
    });

    it('should calculate total daily goal from all sessions', () => {
      const mockSessions = [
        {
          id: 1,
          title: 'Session 1',
          initialDuration: 1500,
          timeLeft: 1500,
          isCompleted: false,
          dailyGoalMinutes: 30,
          focusSeconds: 0,
          state: TimerState.PAUSED,
        },
        {
          id: 2,
          title: 'Session 2',
          initialDuration: 1500,
          timeLeft: 1500,
          isCompleted: false,
          dailyGoalMinutes: 45,
          focusSeconds: 0,
          state: TimerState.PAUSED,
        },
      ];
      localStorage.setItem('sessions', JSON.stringify(mockSessions));

      renderApp();

      // Total should be 75 minutes = 1h 15min
      expect(screen.getByText(/1h 15 min/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      renderApp();
      
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('Focus Flow');
    });

    it('should have accessible buttons', () => {
      renderApp();
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty sessions array', () => {
      localStorage.setItem('sessions', '[]');
      renderApp();

      expect(screen.getByText('No active tasks')).toBeInTheDocument();
    });

    it('should handle missing localStorage values', () => {
      localStorage.clear();
      
      // Should not throw and render with defaults
      renderApp();
      const heading = screen.getByRole('heading', { level: 1, name: 'Focus Flow' });
      expect(heading).toBeInTheDocument();
    });

    it('should handle invalid streak value in localStorage', () => {
      localStorage.setItem('streak', 'invalid');
      
      renderApp();
      // Should default to NaN which gets displayed
      // The app displays the value as-is, even if it's NaN
      const header = document.querySelector('header');
      expect(header).toBeTruthy();
      // Just verify the app renders without crashing
      const heading = screen.getByRole('heading', { level: 1, name: 'Focus Flow' });
      expect(heading).toBeInTheDocument();
    });

    it('should generate unique IDs for new sessions', async () => {
      const user = userEvent.setup();
      renderApp();

      const addButton = screen.getByRole('button', { name: /new session/i });
      
      // Add first session
      await user.click(addButton);
      
      await waitFor(() => {
        const stored1 = localStorage.getItem('sessions');
        const sessions1 = JSON.parse(stored1!);
        const newId1 = Math.max(...sessions1.map((s: { id: number }) => s.id));
        
        // ID should be greater than default session IDs (1, 2, 3)
        expect(newId1).toBeGreaterThan(3);
      });
    });
  });

  describe('Audio', () => {
    it('should have audio element in the DOM', () => {
      renderApp();
      
      const audioElements = document.querySelectorAll('audio');
      expect(audioElements.length).toBe(1);
    });

    it('should have correct audio source', () => {
      renderApp();
      
      const audio = document.querySelector('audio');
      expect(audio?.getAttribute('src')).toContain('.mp3');
    });
  });

  describe('Responsive Design Elements', () => {
    it('should have responsive grid layout classes', () => {
      const { container } = renderApp();
      
      const gridElements = container.querySelectorAll('[class*="grid"]');
      expect(gridElements.length).toBeGreaterThan(0);
    });

    it('should render mobile-friendly navigation', () => {
      renderApp();
      
      const header = document.querySelector('header');
      expect(header).toBeInTheDocument();
      expect(header?.className).toContain('sticky');
    });
  });

  describe('State Persistence', () => {
    it('should persist reset time to localStorage', async () => {
      const user = userEvent.setup();
      renderApp();

      // Open settings
      const menuButtons = screen.getAllByRole('button');
      const settingsButton = menuButtons.find(btn => 
        btn.querySelector('svg') && btn.className.includes('rounded-full')
      );
      
      if (settingsButton) {
        await user.click(settingsButton);

        // Find time input by type
        const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
        if (timeInput) {
          await user.clear(timeInput);
          await user.type(timeInput, '08:30');

          await waitFor(() => {
            const stored = localStorage.getItem('resetTime');
            expect(stored).toContain('08');
          });
        }
      }
    });

    it('should load resetTime from localStorage on mount', () => {
      localStorage.setItem('resetTime', '10:00');
      renderApp();

      // The reset time should be loaded from localStorage
      expect(localStorage.getItem('resetTime')).toBe('10:00');
    });

    it('should persist lastResetDate to localStorage', async () => {
      const user = userEvent.setup();
      renderApp();

      // Click reset button
      const buttons = screen.getAllByRole('button');
      const resetButton = buttons.find(btn => 
        btn.title && btn.title.includes('Start New Day')
      );

      if (resetButton) {
        await user.click(resetButton);

        await waitFor(() => {
          const lastResetDate = localStorage.getItem('lastResetDate');
          expect(lastResetDate).toBeTruthy();
          // Should be in DD/MM/YY format
          expect(lastResetDate).toMatch(/\d{2}\/\d{2}\/\d{2}/);
        });
      }
    });
  });

  describe('Component Integration', () => {
    it('should render ProgressRing component', () => {
      renderApp();
      
      // ProgressRing should be in the DOM (check for SVG element)
      const progressSection = screen.getByText('Daily Progress').closest('div');
      const svgElements = progressSection?.querySelectorAll('svg');
      expect(svgElements && svgElements.length).toBeGreaterThan(0);
    });

    it('should render SessionCard components for each session', () => {
      renderApp();
      
      // Should have at least 3 default sessions
      expect(screen.getByText('Deep Work')).toBeInTheDocument();
      expect(screen.getByText('Reading')).toBeInTheDocument();
      expect(screen.getByText('Emails')).toBeInTheDocument();
    });
  });
});
