import logger from '../logger';

// Mock console methods
const originalConsole = { ...console };

beforeEach(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.debug = jest.fn();
});

afterEach(() => {
  Object.assign(console, originalConsole);
});

describe('Logger', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    // Clear module cache to ensure fresh imports
    jest.resetModules();
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      // Clear module cache and re-import to pick up new NODE_ENV
      jest.resetModules();
    });

    test('log method calls console.log in development', () => {
      const logger = require('../logger').default;
      logger.log('Test message');
      expect(console.log).toHaveBeenCalledWith('Test message');
    });

    test('warn method calls console.warn in development', () => {
      const logger = require('../logger').default;
      logger.warn('Warning message');
      expect(console.warn).toHaveBeenCalledWith('Warning message');
    });

    test('debug method calls console.debug in development', () => {
      const logger = require('../logger').default;
      logger.debug('Debug message');
      expect(console.debug).toHaveBeenCalledWith('Debug message');
    });

    test('error method calls console.error in development', () => {
      const logger = require('../logger').default;
      logger.error('Error message');
      expect(console.error).toHaveBeenCalledWith('Error message');
    });

    test('supports multiple arguments', () => {
      const logger = require('../logger').default;
      logger.log('Message', { data: 'test' }, 123);
      expect(console.log).toHaveBeenCalledWith('Message', { data: 'test' }, 123);
    });
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();
    });

    test('log method does not call console.log in production', () => {
      const logger = require('../logger').default;
      logger.log('Test message');
      expect(console.log).not.toHaveBeenCalled();
    });

    test('warn method does not call console.warn in production', () => {
      const logger = require('../logger').default;
      logger.warn('Warning message');
      expect(console.warn).not.toHaveBeenCalled();
    });

    test('debug method does not call console.debug in production', () => {
      const logger = require('../logger').default;
      logger.debug('Debug message');
      expect(console.debug).not.toHaveBeenCalled();
    });

    test('error method still calls console.error in production', () => {
      const logger = require('../logger').default;
      logger.error('Error message');
      expect(console.error).toHaveBeenCalledWith('Error message');
    });
  });
});