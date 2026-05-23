// @vitest-environment jsdom
import { describe, it } from 'vitest'

// TYPE-03: ColorSwatchPicker — 8-swatch Popover palette; swatches use // allow-hex: swatch palette
// Plan 03 converts these it.todo stubs to live it() tests.
// NOTE: ColorSwatchPicker does not yet exist — do NOT import it here.
// Stubs use it.todo to remain vitest-discoverable without compile failures.

describe('TYPE-03: ColorSwatchPicker — swatch palette', () => {
  it.todo('renders 8 color swatches arranged in a 4-column grid')
  it.todo('currently selected swatch has ring-2 ring-foreground class applied')
  it.todo('clicking a swatch fires onSelect callback with the swatch hex value')
  it.todo('"Custom color…" label triggers native color input change to onSelect')
  it.todo('swatch hex literals use // allow-hex: swatch palette comment so TYPE-06 passes')
})
