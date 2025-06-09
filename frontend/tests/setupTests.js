import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";
import { cleanup } from "@testing-library/react";

// Polyfills for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock window.matchMedia (used by some UI libraries)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver (used by some chart libraries)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock scrollTo
global.scrollTo = jest.fn();

// Mock URL.createObjectURL (used for file handling)
global.URL.createObjectURL = jest.fn(() => "mocked-url");
global.URL.revokeObjectURL = jest.fn();

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Create a functional localStorage mock that actually stores/retrieves values
const createLocalStorageMock = () => {
  let store = {};

  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value?.toString() || "";
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
    // Helper for tests to access the store
    _getStore: () => store,
    _setStore: (newStore) => {
      store = newStore;
    },
  };
};

// Create the mock and make it global so tests can access it
global.mockLocalStorage = createLocalStorageMock();

Object.defineProperty(window, "localStorage", {
  value: global.mockLocalStorage,
  writable: true,
});

// Mock sessionStorage with the same structure
Object.defineProperty(window, "sessionStorage", {
  value: createLocalStorageMock(),
  writable: true,
});

// Mock window.dispatchEvent for auth events
const mockDispatchEvent = jest.fn();
Object.defineProperty(window, "dispatchEvent", {
  value: mockDispatchEvent,
  writable: true,
});
global.mockDispatchEvent = mockDispatchEvent;

// Mock fetch for any components that use it directly
global.fetch = jest.fn();

// Setup for testing library cleanup
afterEach(() => {
  cleanup();
  // Clear all mock calls but preserve mock implementations
  jest.clearAllMocks();
  // Reset localStorage store
  global.mockLocalStorage.clear();
  global.mockLocalStorage._setStore({});
});

// Custom matchers for testing
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Mock crypto for any UUID generation
Object.defineProperty(global, "crypto", {
  value: {
    getRandomValues: jest.fn().mockReturnValue(new Uint32Array(10)),
    randomUUID: jest.fn().mockReturnValue("mock-uuid"),
  },
});

// Mock HTMLCanvasElement (for any canvas-based charts)
HTMLCanvasElement.prototype.getContext = jest.fn();

// Global test utilities
global.testUtils = {
  // Helper to create mock events
  createMockEvent: (overrides = {}) => ({
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    target: { value: "" },
    ...overrides,
  }),

  // Helper to create mock props
  createMockProps: (overrides = {}) => ({
    ...overrides,
  }),

  // Helper for async testing
  waitForNextTick: () => new Promise((resolve) => setTimeout(resolve, 0)),

  // Helper to mock API responses
  mockApiSuccess: (data) => Promise.resolve({ data }),
  mockApiError: (error) => Promise.reject(new Error(error)),
};

// Mock react-router-dom for tests that don't explicitly test routing
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => jest.fn(),
  useParams: () => ({}),
  useLocation: () => ({
    pathname: "/",
    search: "",
    hash: "",
    state: null,
  }),
}));

// Mock recharts to avoid canvas issues in tests
jest.mock("recharts", () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));
