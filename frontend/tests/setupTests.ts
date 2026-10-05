import "@testing-library/jest-dom/vitest";
import { TextEncoder, TextDecoder } from "node:util";
import { cleanup } from "@testing-library/react";
import React from "react";

// Testing Library's waitFor detects fake timers through a global `jest` object
// and advances them with jest.advanceTimersByTime. Point that at Vitest so
// waitFor keeps working when a test uses vi.useFakeTimers().
(globalThis as any).jest = {
  advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
};

// Polyfills for Node.js environment
global.TextEncoder = TextEncoder;
// @ts-ignore - TextDecoder polyfill for Node.js environment
global.TextDecoder = TextDecoder;

// Mock Request for React Router data router compatibility
global.Request = class Request {
  url: string;
  method: string;
  headers: Headers;
  body: any;
  
  constructor(input: string | Request, init?: RequestInit) {
    this.url = typeof input === 'string' ? input : input.url;
    this.method = init?.method || 'GET';
    this.headers = new Headers(init?.headers);
    this.body = init?.body;
  }
  
  clone() {
    return new Request(this.url, {
      method: this.method,
      headers: this.headers,
      body: this.body,
    });
  }
} as any;

// Mock Response for completeness
global.Response = class Response {
  status: number;
  statusText: string;
  headers: Headers;
  body: any;
  
  constructor(body?: any, init?: ResponseInit) {
    this.status = init?.status || 200;
    this.statusText = init?.statusText || 'OK';
    this.headers = new Headers(init?.headers);
    this.body = body;
  }
  
  clone() {
    return new Response(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
    });
  }
  
  json() {
    return Promise.resolve(JSON.parse(this.body));
  }
  
  text() {
    return Promise.resolve(this.body);
  }
} as any;

// Mock Headers
global.Headers = class Headers {
  private map = new Map<string, string>();
  
  constructor(init?: HeadersInit) {
    if (init) {
      if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.map.set(key.toLowerCase(), value));
      } else if (init instanceof Headers) {
        init.forEach((value, key) => this.map.set(key.toLowerCase(), value));
      } else {
        Object.entries(init).forEach(([key, value]) => this.map.set(key.toLowerCase(), value));
      }
    }
  }
  
  append(key: string, value: string) {
    this.map.set(key.toLowerCase(), value);
  }
  
  delete(key: string) {
    this.map.delete(key.toLowerCase());
  }
  
  get(key: string) {
    return this.map.get(key.toLowerCase()) || null;
  }
  
  has(key: string) {
    return this.map.has(key.toLowerCase());
  }
  
  set(key: string, value: string) {
    this.map.set(key.toLowerCase(), value);
  }
  
  forEach(callback: (value: string, key: string) => void) {
    this.map.forEach((value, key) => callback(value, key));
  }
} as any;

// Mock window.matchMedia (used by some UI libraries)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver (used by some chart libraries)
global.ResizeObserver = vi.fn().mockImplementation(function () {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(function () {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
});

// Mock scrollTo
global.scrollTo = vi.fn();

// Mock URL.createObjectURL (used for file handling)
global.URL.createObjectURL = vi.fn(() => "mocked-url");
global.URL.revokeObjectURL = vi.fn();

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Create a functional localStorage mock that actually stores/retrieves values
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value?.toString() || "";
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
    // Helper for tests to access the store
    _getStore: () => store,
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    },
  };
};

// Create the mock and make it global so tests can access it
(global as any).mockLocalStorage = createLocalStorageMock();

Object.defineProperty(window, "localStorage", {
  value: (global as any).mockLocalStorage,
  writable: true,
});

// Mock sessionStorage with the same structure
Object.defineProperty(window, "sessionStorage", {
  value: createLocalStorageMock(),
  writable: true,
});

// Mock window.dispatchEvent for auth events
const mockDispatchEvent = vi.fn();
Object.defineProperty(window, "dispatchEvent", {
  value: mockDispatchEvent,
  writable: true,
});
(global as any).mockDispatchEvent = mockDispatchEvent;

// Mock fetch for any components that use it directly
global.fetch = vi.fn();

// Setup for testing library cleanup
afterEach(() => {
  cleanup();
  // Never leak fake timers into the next test
  vi.useRealTimers();
  // Clear all mock calls but preserve mock implementations
  vi.clearAllMocks();
  // Reset localStorage store
  (global as any).mockLocalStorage.clear();
  (global as any).mockLocalStorage._setStore({});
});

// Custom matchers for testing
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
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
    getRandomValues: vi.fn().mockReturnValue(new Uint32Array(10)),
    randomUUID: vi.fn().mockReturnValue("mock-uuid"),
  },
});

// Mock HTMLCanvasElement (for any canvas-based charts)
HTMLCanvasElement.prototype.getContext = vi.fn();

// Global test utilities
(global as any).testUtils = {
  // Helper to create mock events
  createMockEvent: (overrides = {}) => ({
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
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
  mockApiSuccess: (data: any) => Promise.resolve({ data }),
  mockApiError: (error: string) => Promise.reject(new Error(error)),
};

// Mock react-router for tests that don't explicitly test routing
vi.mock("react-router", async () => ({
  ...(await vi.importActual("react-router")),
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
  useLocation: () => ({
    pathname: "/",
    search: "",
    hash: "",
    state: null,
  }),
}));

// Mock recharts to avoid canvas issues in tests
vi.mock("recharts", async () => {
  const mockReact = (await vi.importActual("react"));
  return {
    LineChart: ({ children }: { children: React.ReactNode }) => 
      mockReact.createElement("div", { "data-testid": "line-chart" }, children),
    Line: () => mockReact.createElement("div", { "data-testid": "line" }),
    XAxis: () => mockReact.createElement("div", { "data-testid": "x-axis" }),
    YAxis: () => mockReact.createElement("div", { "data-testid": "y-axis" }),
    CartesianGrid: () => mockReact.createElement("div", { "data-testid": "cartesian-grid" }),
    Tooltip: () => mockReact.createElement("div", { "data-testid": "tooltip" }),
    Legend: () => mockReact.createElement("div", { "data-testid": "legend" }),
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      mockReact.createElement("div", { "data-testid": "responsive-container" }, children),
  };
});

// Suppress expected console warnings during tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]) => {
  const message = args[0];
  
  // Suppress React act() warnings - these are expected in test environment
  if (typeof message === 'string' && message.includes('An update to') && message.includes('inside a test was not wrapped in act(...)')) {
    return;
  }
  
  // Suppress CORS/Network errors from API calls during tests
  if (typeof message === 'string' && (
    message.includes('Cross origin') ||
    message.includes('Network Error') ||
    message.includes('Error fetching') ||
    message.includes('AxiosError')
  )) {
    return;
  }
  
  // Suppress expected service errors during tests
  if (typeof message === 'string' && (
    message.includes('Error fetching beer styles') ||
    message.includes('Error fetching all yeast analytics') ||
    message.includes('Failed to load') ||
    message.includes('Error getting style-specific analysis') ||
    message.includes('Error loading style guide') ||
    message.includes('getAllStylesList is not a function')
  )) {
    return;
  }
  
  // Allow all other console.error messages to pass through
  originalConsoleError.apply(console, args);
};

console.warn = (...args: any[]) => {
  const message = args[0];
  
  // Suppress React development warnings that are expected in tests
  if (typeof message === 'string' && (
    message.includes('React Hook') ||
    message.includes('Warning: ReactDOM.render') ||
    message.includes('Warning: componentWillMount') ||
    message.includes('Warning: componentWillReceiveProps')
  )) {
    return;
  }
  
  // Suppress expected service warnings during tests
  if (typeof message === 'string' && (
    message.includes('Failed to load unit preferences') ||
    message.includes('Failed to get analytics') ||
    message.includes('using default')
  )) {
    return;
  }
  
  // Allow all other console.warn messages to pass through
  originalConsoleWarn.apply(console, args);
};
