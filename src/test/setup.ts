import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorageMock.clear();
});

beforeEach(() => {
  localStorageMock.clear();
});

// Mock Firebase
vi.mock('../firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

// Mock Firebase auth functions
vi.mock('firebase/auth', () => ({
  signOut: vi.fn(() => Promise.resolve()),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(null);
    return vi.fn(); // unsubscribe function
  }),
}));

// Mock Audio
HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
HTMLMediaElement.prototype.pause = vi.fn();
HTMLMediaElement.prototype.load = vi.fn();
