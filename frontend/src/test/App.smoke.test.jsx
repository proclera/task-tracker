import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App';

const mockUseAuth = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

vi.mock('../pages/LoginPage', () => ({
  LoginPage: () => <div>Login Screen</div>
}));

vi.mock('../pages/AdminDashboard', () => ({
  AdminDashboard: () => <div>Admin Dashboard Screen</div>
}));

vi.mock('../pages/ManagerDashboard', () => ({
  ManagerDashboard: () => <div>Manager Dashboard Screen</div>
}));

vi.mock('../pages/EmployeeDashboard', () => ({
  EmployeeDashboard: () => <div>Employee Dashboard Screen</div>
}));

vi.mock('../components/ToastViewport', () => ({
  ToastViewport: () => <div data-testid="toast-viewport" />
}));

const renderApp = (initialEntries = ['/']) => render(
  <MemoryRouter initialEntries={initialEntries}>
    <App />
  </MemoryRouter>
);

describe('App smoke tests', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('shows the loading screen while auth state is hydrating', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true
    });

    renderApp(['/']);

    expect(screen.getByText('Task Tracker')).toBeInTheDocument();
    expect(screen.getByText('Loading your workspace...')).toBeInTheDocument();
  });

  it('renders the login screen for signed-out users', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });

    renderApp(['/login']);

    expect(screen.getByText('Login Screen')).toBeInTheDocument();
  });

  it('redirects signed-in admins from login to the admin dashboard', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 'admin' },
      loading: false
    });

    renderApp(['/login']);

    expect(await screen.findByText('Admin Dashboard Screen')).toBeInTheDocument();
  });

  it('redirects signed-out users away from protected routes', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });

    renderApp(['/admin']);

    expect(await screen.findByText('Login Screen')).toBeInTheDocument();
  });
});
