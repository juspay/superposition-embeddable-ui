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
