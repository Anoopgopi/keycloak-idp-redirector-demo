import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Callback from '../Callback';

// Mock the Keycloak provider
jest.mock('../../providers/keycloak/KeycloakProvider', () => ({
  KeycloakProvider: jest.fn().mockImplementation(() => ({
    handleCallback: jest.fn(),
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

describe('Callback Component', () => {
  let mockKeycloakProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    // Reset window.location
    delete window.location;
    window.location = {
      href: '',
      origin: 'http://localhost:3001',
      search: '',
    };

    // Reset callback processed flag
    delete window.callbackProcessed;

    // Get the mocked provider instance
    const { KeycloakProvider } = require('../../providers/keycloak/KeycloakProvider');
    mockKeycloakProvider = new KeycloakProvider();

    // Mock localStorage methods
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.getItem = jest.fn();
  });

  describe('Error Handling', () => {
    test('displays error when error parameter is present', async () => {
      window.location.search = '?error=access_denied';

      render(<Callback />);

      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      });
    });

    test('displays error when no code is received', async () => {
      window.location.search = '';

      render(<Callback />);

      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      });
    });

    test('handles callback processing errors', async () => {
      window.location.search = '?code=test-code';
      mockKeycloakProvider.handleCallback.mockRejectedValue(new Error('Token exchange failed'));

      render(<Callback />);

      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      });
    });
  });

  describe('Successful OAuth Callback', () => {
    test('successfully processes Keycloak callback with Google user', async () => {
      window.location.search = '?code=test-code';

      const mockResult = {
        tokens: {
          access_token: 'test-access-token',
          id_token: 'test-id-token'
        },
        user: {
          name: 'Google User',
          email: 'user@gmail.com',
          picture: 'https://example.com/avatar.jpg'
        }
      };

      mockKeycloakProvider.handleCallback.mockResolvedValue(mockResult);

      render(<Callback />);

      await waitFor(() => {
        expect(screen.getByText('Google login successful!')).toBeInTheDocument();
      });

      expect(screen.getByText('Google User')).toBeInTheDocument();
      expect(screen.getByText('user@gmail.com')).toBeInTheDocument();

      expect(Storage.prototype.setItem).toHaveBeenCalledWith('access_token', 'test-access-token');
      expect(Storage.prototype.setItem).toHaveBeenCalledWith('user_info', JSON.stringify(mockResult.user));
      expect(Storage.prototype.setItem).toHaveBeenCalledWith('auth_provider', 'keycloak');
      expect(Storage.prototype.setItem).toHaveBeenCalledWith('identity_provider', 'Google');
    });

    test('successfully processes Keycloak callback with Microsoft user', async () => {
      window.location.search = '?code=test-code';

      const mockResult = {
        tokens: { access_token: 'test-access-token' },
        user: {
          name: 'Microsoft User',
          email: 'user@outlook.com',
          picture: 'https://example.com/ms-avatar.jpg'
        }
      };

      mockKeycloakProvider.handleCallback.mockResolvedValue(mockResult);

      render(<Callback />);

      await waitFor(() => {
        expect(screen.getByText('Microsoft login successful!')).toBeInTheDocument();
      });

      expect(screen.getByText('Microsoft User')).toBeInTheDocument();
      expect(screen.getByText('user@outlook.com')).toBeInTheDocument();
      expect(Storage.prototype.setItem).toHaveBeenCalledWith('identity_provider', 'Microsoft');
    });

    test('successfully processes Keycloak callback with unknown provider', async () => {
      window.location.search = '?code=test-code';

      const mockResult = {
        tokens: { access_token: 'test-access-token' },
        user: {
          name: 'Test User',
          email: 'user@company.com'
        }
      };

      mockKeycloakProvider.handleCallback.mockResolvedValue(mockResult);

      render(<Callback />);

      await waitFor(() => {
        expect(screen.getByText('Login successful!')).toBeInTheDocument();
      });

      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('user@company.com')).toBeInTheDocument();
      expect(Storage.prototype.setItem).toHaveBeenCalledWith('identity_provider', 'Unknown Provider');
    });

    test('renders user avatar when available', async () => {
      window.location.search = '?code=test-code';

      const mockResult = {
        tokens: { access_token: 'test-access-token' },
        user: {
          name: 'Test User',
          email: 'user@gmail.com',
          picture: 'https://example.com/avatar.jpg'
        }
      };

      mockKeycloakProvider.handleCallback.mockResolvedValue(mockResult);

      render(<Callback />);

      await waitFor(() => {
        const avatar = screen.getByAltText('Profile');
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
      });
    });
  });

  describe('Logout Functionality', () => {
    test('renders logout button when user info is available', async () => {
      window.location.search = '?code=test-code';

      const mockResult = {
        tokens: { access_token: 'test-access-token' },
        user: {
          name: 'Test User',
          email: 'user@gmail.com'
        }
      };

      mockKeycloakProvider.handleCallback.mockResolvedValue(mockResult);

      render(<Callback />);

      await waitFor(() => {
        expect(screen.getByText('Logout from Google')).toBeInTheDocument();
      });
    });

    test('logout button calls Keycloak provider logout', async () => {
      window.location.search = '?code=test-code';

      const mockResult = {
        tokens: { access_token: 'test-access-token' },
        user: {
          name: 'Test User',
          email: 'user@gmail.com'
        }
      };

      mockKeycloakProvider.handleCallback.mockResolvedValue(mockResult);
      const user = userEvent.setup();

      render(<Callback />);

      await waitFor(() => {
        expect(screen.getByText('Logout from Google')).toBeInTheDocument();
      });

      const logoutButton = screen.getByText('Logout from Google');
      await user.click(logoutButton);

      expect(mockKeycloakProvider.logout).toHaveBeenCalled();
    });

    test('logout handles errors gracefully', async () => {
      window.location.search = '?code=test-code';

      const mockResult = {
        tokens: { access_token: 'test-access-token' },
        user: {
          name: 'Test User',
          email: 'user@gmail.com'
        }
      };

      mockKeycloakProvider.handleCallback.mockResolvedValue(mockResult);
      mockKeycloakProvider.logout.mockRejectedValue(new Error('Logout failed'));

      // Mock setTimeout to avoid waiting in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => fn());

      const user = userEvent.setup();

      render(<Callback />);

      await waitFor(() => {
        expect(screen.getByText('Logout from Google')).toBeInTheDocument();
      });

      const logoutButton = screen.getByText('Logout from Google');
      await user.click(logoutButton);

      await waitFor(() => {
        expect(mockKeycloakProvider.clearLocalStorage).toHaveBeenCalled();
      });

      global.setTimeout.mockRestore();
    });
  });

  describe('Provider Logo Rendering', () => {
    test('renders Google logo for Gmail users', async () => {
      window.location.search = '?code=test-code';

      const mockResult = {
        tokens: { access_token: 'test-access-token' },
        user: {
          name: 'Google User',
          email: 'user@gmail.com'
        }
      };

      mockKeycloakProvider.handleCallback.mockResolvedValue(mockResult);

      render(<Callback />);

      await waitFor(() => {
        expect(screen.getByText('Logged in via: Google')).toBeInTheDocument();
      });
    });

    test('renders Microsoft logo for Outlook users', async () => {
      window.location.search = '?code=test-code';

      const mockResult = {
        tokens: { access_token: 'test-access-token' },
        user: {
          name: 'Microsoft User',
          email: 'user@outlook.com'
        }
      };

      mockKeycloakProvider.handleCallback.mockResolvedValue(mockResult);

      render(<Callback />);

      await waitFor(() => {
        expect(screen.getByText('Logged in via: Microsoft')).toBeInTheDocument();
      });
    });

    test('prevents multiple callback processing', async () => {
      window.location.search = '?code=test-code';
      window.callbackProcessed = true;

      render(<Callback />);

      // Should not call handleCallback if already processed
      expect(mockKeycloakProvider.handleCallback).not.toHaveBeenCalled();
    });
  });
});