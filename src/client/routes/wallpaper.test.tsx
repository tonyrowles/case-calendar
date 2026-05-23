// @vitest-environment jsdom
// Wave 3 (Plan 04) implements WallpaperView.
// These todos become live it() tests when wallpaper.tsx is created in Plan 04.
import { describe, it } from 'vitest'

describe('WallpaperView smoke (HOOK-01)', () => {
  it.todo('renders without throwing when given empty deadlines')
  it.todo('renders 15 columns (1 Overdue + 14 day columns)')
  it.todo('renders "Case Calendar Deadlines" header text')
  it.todo('renders "Last updated:" timestamp text')
  it.todo('applies 7680x2160 container styles (width: 7680px, height: 2160px)')
})

describe('WallpaperView data selection', () => {
  it.todo('places overdue deadlines (date < today AND completedAt === null) in the Overdue column')
  it.todo('places upcoming deadlines (date in next 14 days) in their matching date column')
  it.todo('ignores completed deadlines (completedAt !== null) entirely')
})
