import '@testing-library/jest-dom';

// ─── Global mocks ────────────────────────────────────────────────────────────

// EventSource (SSE) — not available in jsdom
class EventSourceMock {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror:   ((event: Event) => void) | null = null;
  close() {}
}
Object.defineProperty(globalThis, 'EventSource', { value: EventSourceMock, writable: true });

// localStorage — jsdom provides it but zustand persist may need it
if (typeof globalThis.localStorage === 'undefined') {
  const storage: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem:    (k: string) => storage[k] ?? null,
      setItem:    (k: string, v: string) => { storage[k] = v; },
      removeItem: (k: string) => { delete storage[k]; },
      clear:      () => { Object.keys(storage).forEach(k => delete storage[k]); },
    },
  });
}

// Silence console.error for known React warnings in tests
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Warning:')) return;
  originalConsoleError(...args);
};
