import "@testing-library/jest-dom/vitest";

Object.defineProperty(globalThis, "CSS", {
  value: {
    ...(globalThis.CSS ?? {}),
    supports: globalThis.CSS?.supports ?? (() => false),
  },
  configurable: true,
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  value: globalThis.ResizeObserver ?? ResizeObserverMock,
  configurable: true,
  writable: true,
});

Object.defineProperty(window, "ResizeObserver", {
  value: window.ResizeObserver ?? ResizeObserverMock,
  configurable: true,
  writable: true,
});

const matchMediaMock =
  window.matchMedia ??
  ((query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));

Object.defineProperty(globalThis, "matchMedia", {
  value: matchMediaMock,
  configurable: true,
  writable: true,
});

Object.defineProperty(window, "matchMedia", {
  value: matchMediaMock,
  configurable: true,
  writable: true,
});

Object.defineProperty(window, "scrollTo", {
  value: () => {},
  configurable: true,
  writable: true,
});
