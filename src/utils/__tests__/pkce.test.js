import { generateCodeVerifier, generateCodeChallenge } from '../pkce';

// Mock crypto API for Node.js environment
const mockCrypto = {
  getRandomValues: jest.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: {
    digest: jest.fn((algorithm, data) => {
      // Mock SHA-256 digest - return a consistent ArrayBuffer for testing
      const mockDigest = new ArrayBuffer(32);
      const view = new Uint8Array(mockDigest);
      for (let i = 0; i < 32; i++) {
        view[i] = i; // Predictable values for testing
      }
      return Promise.resolve(mockDigest);
    })
  }
};

// Mock TextEncoder for Node.js environment
const mockTextEncoder = {
  encode: jest.fn((text) => new Uint8Array(Buffer.from(text, 'utf8')))
};

// Setup global mocks
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

Object.defineProperty(global, 'TextEncoder', {
  value: jest.fn(() => mockTextEncoder),
  writable: true
});

// Mock btoa for Node.js environment
Object.defineProperty(global, 'btoa', {
  value: jest.fn((str) => Buffer.from(str, 'binary').toString('base64')),
  writable: true
});

describe('PKCE Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  describe('generateCodeVerifier', () => {
    test('generates a code verifier string', () => {
      const verifier = generateCodeVerifier();
      
      expect(typeof verifier).toBe('string');
      expect(verifier.length).toBeGreaterThan(0);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/); // Base64URL format
    });

    test('generates different verifiers on each call', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      
      expect(verifier1).not.toBe(verifier2);
    });
  });

  describe('generateCodeChallenge', () => {
    test('generates a code challenge from verifier', async () => {
      const verifier = 'test-code-verifier';
      const challenge = await generateCodeChallenge(verifier);
      
      expect(typeof challenge).toBe('string');
      expect(challenge.length).toBeGreaterThan(0);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/); // Base64URL format
    });

    test('generates consistent challenge for same verifier', async () => {
      const verifier = 'test-code-verifier';
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);
      
      expect(challenge1).toBe(challenge2);
    });

    test('generates different challenges for different verifiers', async () => {
      const challenge1 = await generateCodeChallenge('verifier1');
      const challenge2 = await generateCodeChallenge('verifier2');
      
      expect(challenge1).not.toBe(challenge2);
    });
  });

  // Note: buildAuthUrl tests removed as this function is now handled by individual provider classes
});