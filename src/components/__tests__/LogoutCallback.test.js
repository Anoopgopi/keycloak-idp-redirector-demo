import React from 'react';
import { render, screen } from '@testing-library/react';
import LogoutCallback from '../LogoutCallback';

// Mock logger
jest.mock('../../utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn()
}));

describe('LogoutCallback Component', () => {
  let mockPostMessage;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock window.parent.postMessage
    mockPostMessage = jest.fn();
    Object.defineProperty(window, 'parent', {
      value: {
        postMessage: mockPostMessage
      },
      writable: true
    });
  });

  afterEach(() => {
    // Reset window.parent
    Object.defineProperty(window, 'parent', {
      value: window,
      writable: true
    });
  });

  test('renders logout message and spinner', () => {
    render(<LogoutCallback />);
    
    expect(screen.getByText('Logging out...')).toBeInTheDocument();
    expect(screen.getByText('Please wait while we complete the logout process.')).toBeInTheDocument();
  });

  test('sends logout-complete message to parent window', () => {
    const logger = require('../../utils/logger');
    
    render(<LogoutCallback />);
    
    expect(mockPostMessage).toHaveBeenCalledWith('logout-complete', '*');
    expect(logger.log).toHaveBeenCalledWith('Sent logout-complete message to parent window');
  });

  test('handles postMessage error gracefully', () => {
    const logger = require('../../utils/logger');
    mockPostMessage.mockImplementation(() => {
      throw new Error('PostMessage failed');
    });
    
    render(<LogoutCallback />);
    
    expect(logger.warn).toHaveBeenCalledWith('Could not send message to parent window:', expect.any(Error));
  });

  test('does not send message when not in iframe', () => {
    // Mock window.parent to be the same as window (not in iframe)
    Object.defineProperty(window, 'parent', {
      value: window,
      writable: true
    });
    
    render(<LogoutCallback />);
    
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  test('applies correct styling', () => {
    const { container } = render(<LogoutCallback />);
    
    const containerDiv = container.firstChild;
    expect(containerDiv).toHaveStyle({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh'
    });
  });
});