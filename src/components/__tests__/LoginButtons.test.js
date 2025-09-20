import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginButtons from '../LoginButtons';

// Mock the Keycloak provider
jest.mock('../../providers/keycloak/KeycloakProvider', () => ({
  KeycloakProvider: jest.fn().mockImplementation(() => ({
    isConfigured: jest.fn().mockReturnValue(true),
    isValidEmail: jest.fn().mockReturnValue(true),
    determineLoginHintFromEmail: jest.fn().mockImplementation((email) => {
      const domain = email.split('@')[1];
      if (domain === 'gmail.com') return 'google';
      if (domain === 'outlook.com') return 'microsoft';
      return null;
    }),
    login: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    clearLocalStorage: jest.fn()
  }))
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('LoginButtons Component', () => {
  let mockKeycloakProvider;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    
    // Get the mocked provider instance
    const { KeycloakProvider } = require('../../providers/keycloak/KeycloakProvider');
    mockKeycloakProvider = new KeycloakProvider();
  });

  describe('Login State (Not Logged In)', () => {
    test('renders login page with title and email input', () => {
      render(<LoginButtons />);
      
      expect(screen.getByText('Keycloak IDP Redirector Demo')).toBeInTheDocument();
      expect(screen.getByText('Automatic identity provider routing based on email domain')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
      expect(screen.getByText('Login')).toBeInTheDocument();
    });

    test('renders identity provider detection information', () => {
      render(<LoginButtons />);
      
      expect(screen.getByText(' Automatic Identity Provider Detection:')).toBeInTheDocument();
      expect(screen.getByText(/Gmail addresses.*Google login/)).toBeInTheDocument();
      expect(screen.getByText(/Microsoft addresses.*Microsoft login/)).toBeInTheDocument();
      expect(screen.getByText(/Other addresses.*Standard Keycloak login/)).toBeInTheDocument();
    });

    test('allows user to enter email address', async () => {
      const user = userEvent.setup();
      render(<LoginButtons />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email address');
      await user.type(emailInput, 'test@gmail.com');
      
      expect(emailInput).toHaveValue('test@gmail.com');
    });

    test('login button calls Keycloak provider with no hint for empty email', async () => {
      const user = userEvent.setup();
      render(<LoginButtons />);
      
      const loginButton = screen.getByText('Login');
      await user.click(loginButton);
      
      await waitFor(() => {
        expect(mockKeycloakProvider.login).toHaveBeenCalledWith(
          'http://localhost/callback',
          null
        );
      });
    });

    test('login button calls Keycloak provider with Google hint for Gmail', async () => {
      const user = userEvent.setup();
      render(<LoginButtons />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email address');
      await user.type(emailInput, 'user@gmail.com');
      
      const loginButton = screen.getByText('Login');
      await user.click(loginButton);
      
      await waitFor(() => {
        expect(mockKeycloakProvider.determineLoginHintFromEmail).toHaveBeenCalledWith('user@gmail.com');
        expect(mockKeycloakProvider.login).toHaveBeenCalledWith(
          'http://localhost/callback',
          'google'
        );
      });
    });

    test('login button calls Keycloak provider with Microsoft hint for Outlook', async () => {
      const user = userEvent.setup();
      render(<LoginButtons />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email address');
      await user.type(emailInput, 'user@outlook.com');
      
      const loginButton = screen.getByText('Login');
      await user.click(loginButton);
      
      await waitFor(() => {
        expect(mockKeycloakProvider.determineLoginHintFromEmail).toHaveBeenCalledWith('user@outlook.com');
        expect(mockKeycloakProvider.login).toHaveBeenCalledWith(
          'http://localhost/callback',
          'microsoft'
        );
      });
    });

    test('shows alert when Keycloak is not configured', async () => {
      mockKeycloakProvider.isConfigured.mockReturnValue(false);
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      const user = userEvent.setup();
      
      render(<LoginButtons />);
      
      const loginButton = screen.getByText('Login');
      await user.click(loginButton);
      
      expect(alertSpy).toHaveBeenCalledWith('Keycloak is not configured. Please check your environment variables.');
      alertSpy.mockRestore();
    });

    test('shows alert for invalid email', async () => {
      mockKeycloakProvider.isValidEmail.mockReturnValue(false);
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      const user = userEvent.setup();
      
      render(<LoginButtons />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email address');
      await user.type(emailInput, 'invalid-email');
      
      const loginButton = screen.getByText('Login');
      await user.click(loginButton);
      
      expect(alertSpy).toHaveBeenCalledWith('Please enter a valid email address');
      alertSpy.mockRestore();
    });
  });

  describe('Logged In State', () => {
    beforeEach(() => {
      // Mock localStorage to simulate logged in state
      Storage.prototype.getItem = jest.fn((key) => {
        switch (key) {
          case 'user_info':
            return JSON.stringify({
              name: 'Test User',
              email: 'test@example.com',
              picture: 'https://example.com/avatar.jpg'
            });
          case 'access_token':
            return 'mock-access-token';
          default:
            return null;
        }
      });
    });

    test('renders welcome page when logged in', () => {
      render(<LoginButtons />);
      
      expect(screen.getByText('Welcome Back!')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('Keycloak')).toBeInTheDocument();
    });

    test('renders user avatar when available', () => {
      render(<LoginButtons />);
      
      const avatar = screen.getByAltText('Profile');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    test('renders Keycloak logout button', () => {
      render(<LoginButtons />);
      
      expect(screen.getByText('Logout from Keycloak')).toBeInTheDocument();
    });

    test('logout button calls Keycloak provider logout', async () => {
      const user = userEvent.setup();
      
      render(<LoginButtons />);
      
      const logoutButton = screen.getByText('Logout from Keycloak');
      await user.click(logoutButton);
      
      await waitFor(() => {
        expect(mockKeycloakProvider.logout).toHaveBeenCalled();
      });
    });

    test('logout clears local state on success', async () => {
      const user = userEvent.setup();
      
      render(<LoginButtons />);
      
      const logoutButton = screen.getByText('Logout from Keycloak');
      await user.click(logoutButton);
      
      await waitFor(() => {
        expect(mockKeycloakProvider.logout).toHaveBeenCalled();
      });
      
      // After logout, should show login form again
      await waitFor(() => {
        expect(screen.getByText('Keycloak IDP Redirector Demo')).toBeInTheDocument();
      });
    });

    test('logout handles errors gracefully', async () => {
      mockKeycloakProvider.logout.mockRejectedValue(new Error('Logout failed'));
      const user = userEvent.setup();
      
      render(<LoginButtons />);
      
      const logoutButton = screen.getByText('Logout from Keycloak');
      await user.click(logoutButton);
      
      await waitFor(() => {
        expect(mockKeycloakProvider.logout).toHaveBeenCalled();
        expect(mockKeycloakProvider.clearLocalStorage).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    test('handles login errors gracefully', async () => {
      mockKeycloakProvider.login.mockRejectedValue(new Error('Network error'));
      
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      const user = userEvent.setup();
      
      render(<LoginButtons />);
      
      const loginButton = screen.getByText('Login');
      await user.click(loginButton);
      
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Failed to initiate login: Network error');
      });
      
      alertSpy.mockRestore();
    });

    test('handles invalid stored user info gracefully', () => {
      // Mock invalid JSON in localStorage
      Storage.prototype.getItem = jest.fn((key) => {
        if (key === 'access_token') return 'mock-token';
        if (key === 'user_info') return 'invalid-json{';
        return null;
      });
      
      Storage.prototype.removeItem = jest.fn();
      
      render(<LoginButtons />);
      
      // Should show login form instead of user info
      expect(screen.getByText('Keycloak IDP Redirector Demo')).toBeInTheDocument();
      expect(Storage.prototype.removeItem).toHaveBeenCalledWith('access_token');
      expect(Storage.prototype.removeItem).toHaveBeenCalledWith('user_info');
    });
  });
});