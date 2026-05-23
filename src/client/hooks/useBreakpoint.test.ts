// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useBreakpoint } from './useBreakpoint.js'

// Helper: create a matchMedia mock factory for a given inner width.
// Returns a matchMedia function that evaluates min-width queries against the provided width.
function makeMatchMediaMock(innerWidth: number) {
  return function matchMedia(query: string) {
    let matches = false
    const minWidthMatch = query.match(/\(min-width:\s*(\d+)px\)/)
    if (minWidthMatch) {
      matches = innerWidth >= parseInt(minWidthMatch[1], 10)
    }
    return {
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }
  }
}

function setInnerWidth(w: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: w,
  })
}

function installMatchMedia(w: number) {
  setInnerWidth(w)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: makeMatchMediaMock(w),
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useBreakpoint', () => {
  it("returns 'one' at width 360", () => {
    installMatchMedia(360)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('one')
  })

  it("returns 'one' at width 1279", () => {
    installMatchMedia(1279)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('one')
  })

  it("returns 'two' at width 1280", () => {
    installMatchMedia(1280)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('two')
  })

  it("returns 'two' at width 1919", () => {
    installMatchMedia(1919)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('two')
  })

  it("returns 'three' at width 1920", () => {
    installMatchMedia(1920)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('three')
  })

  it("returns 'three' at width 7680", () => {
    installMatchMedia(7680)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('three')
  })

  it("updates tier when matchMedia change event fires", () => {
    // Start at 1280 (tier='two')
    setInnerWidth(1280)

    // We need to capture the listeners added by the hook so we can fire them manually
    const capturedListeners: Array<EventListenerOrEventListenerObject> = []

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: function matchMedia(query: string) {
        let matches = false
        const minWidthMatch = query.match(/\(min-width:\s*(\d+)px\)/)
        if (minWidthMatch) {
          matches = window.innerWidth >= parseInt(minWidthMatch[1], 10)
        }
        return {
          matches,
          media: query,
          addEventListener: vi.fn((event: string, listener: EventListenerOrEventListenerObject) => {
            if (event === 'change') capturedListeners.push(listener)
          }),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
          onchange: null,
        }
      },
    })

    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('two')

    // Simulate viewport change to 1920
    setInnerWidth(1920)

    // Fire the captured change listeners
    act(() => {
      for (const listener of capturedListeners) {
        if (typeof listener === 'function') {
          listener(new Event('change'))
        } else {
          listener.handleEvent(new Event('change'))
        }
      }
    })

    expect(result.current).toBe('three')
  })
})
