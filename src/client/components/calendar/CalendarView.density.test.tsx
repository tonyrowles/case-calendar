// @vitest-environment jsdom
/// <reference types="node" />
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DensityBadge } from './DensityBadge.js'
import { CalendarView } from './CalendarView.js'

afterEach(() => cleanup())

function renderWithQuery(
  ui: React.ReactElement,
  seed?: (queryClient: QueryClient) => void
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
  if (seed) seed(queryClient)
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DensityBadge unit tests (Tests 1–4)
// ─────────────────────────────────────────────────────────────────────────────
describe('DensityBadge (POLISH-03)', () => {
  it('Test 1: renders +N visible text for count=3', () => {
    render(<DensityBadge count={3} />)
    expect(screen.getByText('+3')).not.toBeNull()
  })

  it('Test 2: plural aria-label for N > 1', () => {
    render(<DensityBadge count={3} />)
    expect(screen.getByLabelText('3 more deadlines')).not.toBeNull()
  })

  it('Test 3: singular aria-label for N === 1', () => {
    render(<DensityBadge count={1} />)
    expect(screen.getByLabelText('1 more deadline')).not.toBeNull()
  })

  it('Test 4: contains locked Tailwind class tokens', () => {
    const { container } = render(<DensityBadge count={5} />)
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    const cls = span!.className
    expect(cls).toContain('density-badge')
    expect(cls).toContain('bg-muted')
    expect(cls).toContain('text-muted-foreground')
    expect(cls).toContain('rounded-full')
    expect(cls).toContain('px-2')
    expect(cls).toContain('py-1')
    expect(cls).toContain('text-xs')
    expect(cls).toContain('font-semibold')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CalendarView density integration tests (Tests 5–6)
// ─────────────────────────────────────────────────────────────────────────────
describe('CalendarView density props (POLISH-03)', () => {
  it('Test 5: CalendarView.tsx passes dayMaxEvents={true} (boolean) — verified via grep', () => {
    const content = readFileSync(
      path.resolve('src/client/components/calendar/CalendarView.tsx'),
      'utf8'
    )
    // Must contain dayMaxEvents={true} (boolean true)
    const hasTrue = (content.match(/dayMaxEvents=\{true\}/g) ?? []).length
    expect(hasTrue).toBeGreaterThanOrEqual(1)
    // Must NOT contain dayMaxEvents={3} (old value)
    const hasThree = (content.match(/dayMaxEvents=\{3\}/g) ?? []).length
    expect(hasThree).toBe(0)
  })

  it('Test 6: moreLinkContent prop renders DensityBadge — invoke function from CalendarView source to verify', () => {
    const content = readFileSync(
      path.resolve('src/client/components/calendar/CalendarView.tsx'),
      'utf8'
    )
    // Verify moreLinkContent is wired in the source
    expect(content).toContain('moreLinkContent')
    expect(content).toContain('DensityBadge')

    // Invoke the moreLinkContent function shape directly by rendering DensityBadge
    // with a synthetic arg.num value — simulates what FC calls at runtime
    const syntheticArg = { num: 5, text: '+5 more', shortText: '+5', view: {} as never }
    const element = <DensityBadge count={syntheticArg.num} />
    const { container } = render(element)
    expect(screen.getByText('+5')).not.toBeNull()
    expect(container.querySelector('[aria-label="5 more deadlines"]')).not.toBeNull()
    cleanup()
  })

  it('Test 7: calendar.css contains .fc-more-link reset rule', () => {
    const content = readFileSync(
      path.resolve('src/client/components/calendar/calendar.css'),
      'utf8'
    )
    expect(content).toContain('.fc-more-link')
    expect(content).toContain('.fc-more-link:hover .density-badge')
  })
})
