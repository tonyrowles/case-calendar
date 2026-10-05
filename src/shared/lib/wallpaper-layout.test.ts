import { describe, it, expect } from 'vitest'
import { allocateListRows, autoIconColumns, computeWallpaperLayout } from './wallpaper-layout.js'

const layout = (width: number, height: number, iconSide: 'left' | 'right' | 'none' = 'left', iconColumns: number | null = null) =>
  computeWallpaperLayout({ width, height, iconSide, iconColumns })

describe('computeWallpaperLayout', () => {
  it('reproduces the original G9 design at 7680x2160', () => {
    const l = layout(7680, 2160)
    expect(l).toMatchObject({ scale: 1, mode: 'side', weeks: 5, maxPerCell: 3, listWidth: 1400, rowsPerColumn: 14 })
    expect(l.gutter).toEqual({ side: 'left', width: 480 })
    expect(l.font.chipTitle).toBe(34)
  })

  it('ultrawide 3440x1440 (21:9) keeps the side-by-side layout, scaled down', () => {
    const l = layout(3440, 1440)
    expect(l.mode).toBe('side')
    expect(l.scale).toBeCloseTo(2 / 3)
    expect(l.gutter.width).toBe(3 * 80)
    expect(l.maxPerCell).toBeGreaterThanOrEqual(2)
  })

  it('16:9 and 16:10 screens stack the list under the calendar', () => {
    for (const [w, h] of [[1920, 1080], [2560, 1440], [3840, 2160], [1920, 1200], [1280, 800]]) {
      const l = layout(w, h)
      expect(l.mode, `${w}x${h}`).toBe('stacked')
      expect(l.weeks).toBeGreaterThanOrEqual(3)
      expect(l.maxPerCell).toBeGreaterThanOrEqual(1)
      expect(l.rowsPerColumn).toBeGreaterThanOrEqual(1)
    }
    expect(layout(3840, 2160).listColumns).toHaveLength(2)
    // Common 16:9 screens get 4 weeks with 2 entries per day
    for (const [w, h] of [[1920, 1080], [2560, 1440], [3840, 2160]]) {
      expect(layout(w, h)).toMatchObject({ weeks: 4, maxPerCell: 2 })
    }
  })

  it('portrait screens stack too, with a single-column list when narrow', () => {
    const l = layout(1080, 1920)
    expect(l.mode).toBe('stacked')
    expect(l.listColumns).toEqual([['today', 'thisWeek', 'nextWeek', 'later']])
  })

  it('text never drops below 11px, even on very small screens', () => {
    const l = layout(1024, 600)
    expect(Math.min(...Object.values(l.font))).toBeGreaterThanOrEqual(11)
  })

  it('icon gutter: side, explicit columns, or none', () => {
    expect(layout(1920, 1080, 'right').gutter).toEqual({ side: 'right', width: 160 })
    expect(layout(1920, 1080, 'left', 4).gutter.width).toBe(320)
    expect(layout(1920, 1080, 'none').gutter.width).toBe(0)
    expect(autoIconColumns(7680)).toBe(6)
    expect(autoIconColumns(1920)).toBe(2)
  })
})

describe('allocateListRows', () => {
  it('hands each column budget to its sections in order', () => {
    const counts = { overdue: 0, today: 2, thisWeek: 5, nextWeek: 4, later: 30 }
    expect(allocateListRows({ listColumns: [['today', 'thisWeek', 'nextWeek', 'later']], rowsPerColumn: 10 }, counts))
      .toMatchObject({ today: 2, thisWeek: 5, nextWeek: 3, later: 0 })
    expect(allocateListRows({ listColumns: [['today', 'thisWeek'], ['nextWeek', 'later']], rowsPerColumn: 6 }, counts))
      .toMatchObject({ today: 2, thisWeek: 4, nextWeek: 4, later: 2 })
  })
})
