// Wallpaper layout for any screen. Everything is derived from the screen's LOGICAL size
// (physical pixels / Windows display scaling), so a 1080p monitor, a 4K laptop at 200%
// and a 7680x2160 ultrawide all get proportionate text and a layout that fits.
//
// Calibration: at a logical height of 2160 the sizes below are exactly the original
// 7680x2160 (32:9) design (scale 1). Wide screens (>= 2:1) put the list beside the calendar;
// narrower and portrait screens stack the list under the calendar in columns.

import type { Bucket } from './buckets.js'

export type IconSide = 'left' | 'right' | 'none'
export const ICON_SIDES: readonly IconSide[] = ['left', 'right', 'none']

/** One Windows desktop icon column at 100% scaling, in logical px. */
export const ICON_COLUMN_PX = 80

export interface LayoutInput {
  /** Logical (CSS) pixels */
  width: number
  height: number
  iconSide: IconSide
  /** Desktop icon columns to leave clear; null = automatic for the screen width */
  iconColumns: number | null
}

/** Base sizes at scale 1 (logical height 2160). */
const BASE = {
  pad: 64,
  gap: 96,
  border: 2,
  bar: 8,
  todayRing: 4,
  cellPad: 12,
  cellGap: 8,
  listWidth: 1400,
  listDateWidth: 220,
  font: {
    range: 48, todayDate: 36, weekday: 30, dayNum: 30,
    chipTitle: 34, chipMeta: 26, more: 24,
    listDate: 30, listTitle: 32, listMeta: 26,
    bucketTitle: 36, empty: 30, footer: 24, reminder: 30,
  },
}

type FontKey = keyof typeof BASE.font

export interface WallpaperLayout {
  width: number
  height: number
  scale: number
  /** 'side' = list beside the calendar; 'stacked' = list under it */
  mode: 'side' | 'stacked'
  pad: number
  gap: number
  border: number
  bar: number
  todayRing: number
  cellPad: number
  cellGap: number
  gutter: { side: IconSide; width: number }
  /** side mode: list pane width */
  listWidth: number
  listDateWidth: number
  font: Record<FontKey, number>
  /** line heights, px */
  line: Record<FontKey, number>
  weeks: number
  maxPerCell: number
  /**
   * Which buckets go in which list column (side mode: one column), and how many rows each
   * column can hold. Overflow beyond the budget is shown as "+N more", never clipped.
   */
  listColumns: Bucket[][]
  rowsPerColumn: number
  /** stacked mode: exact height of the list area under the calendar, px */
  stackedListHeight: number
}

const LIST_BUCKETS: Bucket[] = ['today', 'thisWeek', 'nextWeek', 'later']

export function autoIconColumns(logicalWidth: number): number {
  return Math.max(2, Math.min(6, Math.round(logicalWidth / 1280)))
}

export function computeWallpaperLayout(input: LayoutInput): WallpaperLayout {
  const width = Math.max(320, Math.round(input.width))
  const height = Math.max(240, Math.round(input.height))
  // Scale from height, kept in a readable range (tiny screens still get legible text)
  const scale = Math.min(1.5, Math.max(0.4, height / 2160))
  const px = (n: number) => Math.round(n * scale)
  const atLeast1 = (n: number) => Math.max(1, px(n))

  const font = Object.fromEntries(
    Object.entries(BASE.font).map(([k, v]) => [k, Math.max(11, px(v))])
  ) as Record<FontKey, number>
  const line = Object.fromEntries(
    Object.entries(font).map(([k, v]) => [k, Math.round(v * 1.2)])
  ) as Record<FontKey, number>

  const pad = px(BASE.pad)
  const gap = px(BASE.gap)
  const cellPad = px(BASE.cellPad)
  const cellGap = px(BASE.cellGap)
  const border = atLeast1(BASE.border)
  const columns = input.iconSide === 'none' ? 0 : (input.iconColumns ?? autoIconColumns(width))
  const gutter = { side: input.iconSide, width: input.iconSide === 'none' ? 0 : Math.round(columns * ICON_COLUMN_PX) }

  const contentW = width - 2 * pad - gutter.width
  const headerH = line.range + px(16) + border + px(32)
  const contentH = height - 2 * pad - headerH - px(32)
  const mode: 'side' | 'stacked' = width / height >= 2 ? 'side' : 'stacked'

  // Calendar height available for the week rows
  const listHStacked = Math.round(contentH * (height > width ? 0.45 : 0.3))
  const calendarH = mode === 'side' ? contentH : contentH - listHStacked - gap
  const gridH = calendarH - line.weekday - px(8)

  // A chip is a title line + a case/type line
  const chipH = line.chipTitle + line.chipMeta + px(8) + cellGap
  const fitPerCell = (weeks: number) =>
    Math.floor((gridH / weeks - 2 * cellPad - line.dayNum - cellGap - line.more) / chipH)
  // Prefer 5 weeks; fewer if cells would hold < 2 entries (never below 3 weeks)
  let weeks = 5
  while (weeks > 3 && fitPerCell(weeks) < 2) weeks--
  const maxPerCell = Math.max(1, Math.min(5, fitPerCell(weeks)))

  // List rows
  const rowH = Math.max(line.listTitle + line.listMeta, line.listDate) + px(8) + px(12)
  // Title + rule + spacing, plus one more line for either the empty text or "+N more"
  const sectionOverhead = line.bucketTitle + px(8) + border + px(16) + px(40) + line.empty
  let listColumns: Bucket[][]
  let rowsPerColumn: number
  if (mode === 'side') {
    listColumns = [LIST_BUCKETS]
    rowsPerColumn = Math.floor((contentH - LIST_BUCKETS.length * sectionOverhead) / rowH)
  } else {
    const colMin = px(1000)
    const n = contentW >= 4 * colMin ? 4 : contentW >= 2 * colMin ? 2 : 1
    listColumns = n === 4 ? LIST_BUCKETS.map(b => [b]) : n === 2 ? [['today', 'thisWeek'], ['nextWeek', 'later']] : [LIST_BUCKETS]
    const sectionsPerColumn = LIST_BUCKETS.length / n
    rowsPerColumn = Math.floor((listHStacked - sectionsPerColumn * sectionOverhead) / rowH)
  }

  return {
    width, height, scale, mode, pad, gap, border,
    bar: atLeast1(BASE.bar),
    todayRing: atLeast1(BASE.todayRing),
    cellPad, cellGap, gutter,
    listWidth: px(BASE.listWidth),
    listDateWidth: px(BASE.listDateWidth),
    font, line, weeks, maxPerCell,
    listColumns,
    rowsPerColumn: Math.max(1, rowsPerColumn),
    stackedListHeight: listHStacked,
  }
}

/**
 * Hand each list column's row budget to its sections in order. Returns how many rows each
 * bucket may show; the rest become "+N more".
 */
export function allocateListRows(layout: Pick<WallpaperLayout, 'listColumns' | 'rowsPerColumn'>, counts: Record<Bucket, number>): Record<Bucket, number> {
  const limits = { overdue: 0, today: 0, thisWeek: 0, nextWeek: 0, later: 0 } as Record<Bucket, number>
  for (const column of layout.listColumns) {
    let remaining = layout.rowsPerColumn
    for (const bucket of column) {
      const n = Math.min(counts[bucket], remaining)
      limits[bucket] = n
      remaining -= n
    }
  }
  return limits
}
