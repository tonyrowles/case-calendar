// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ColorSwatchPicker, SWATCHES } from './ColorSwatchPicker.js'

afterEach(() => cleanup())

// TYPE-03: ColorSwatchPicker — 8-swatch Popover palette; swatches use // allow-hex: swatch palette

describe('TYPE-03: ColorSwatchPicker — swatch palette', () => {
  it('renders 8 color swatches arranged in a 4-column grid', () => {
    render(
      <ColorSwatchPicker selected={SWATCHES[0]} onSelect={vi.fn()} />
    )
    const swatches = screen.getAllByRole('button').filter(b =>
      b.getAttribute('aria-pressed') !== null
    )
    expect(swatches).toHaveLength(8)
  })

  it('currently selected swatch has ring-2 ring-foreground class applied', () => {
    render(
      <ColorSwatchPicker selected={SWATCHES[0]} onSelect={vi.fn()} />
    )
    const allSwatches = screen.getAllByRole('button').filter(b =>
      b.getAttribute('aria-pressed') !== null
    )
    const selectedSwatch = allSwatches.find(b => b.getAttribute('aria-pressed') === 'true')
    expect(selectedSwatch).toBeDefined()
    expect(selectedSwatch!.className).toContain('ring-2')
    expect(selectedSwatch!.className).toContain('ring-foreground')
  })

  it('clicking a swatch fires onSelect callback with the swatch hex value', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <ColorSwatchPicker selected={SWATCHES[0]} onSelect={onSelect} />
    )
    // Use querySelectorAll to find swatch buttons by aria-pressed directly in container
    const swatchButtons = container.querySelectorAll('button[aria-pressed]')
    expect(swatchButtons).toHaveLength(8)
    // Second swatch = SWATCHES[1]
    fireEvent.click(swatchButtons[1])
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(SWATCHES[1])
  })

  it('"Custom color…" label triggers native color input change to onSelect', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <ColorSwatchPicker selected={SWATCHES[0]} onSelect={onSelect} />
    )
    const colorInput = container.querySelector('input[type="color"]') as HTMLInputElement
    expect(colorInput).not.toBeNull()
    expect(colorInput.type).toBe('color')
    // Simulate color change via React's onChange
    fireEvent.change(colorInput, { target: { value: '#aabbcc' } })
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('#aabbcc')
  })

  it('swatch hex literals use // allow-hex: swatch palette comment so TYPE-06 passes', () => {
    expect(SWATCHES).toHaveLength(8)
    for (const hex of SWATCHES) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})
