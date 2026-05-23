import React from 'react'

export const SWATCHES = [ // allow-hex: swatch palette
  '#1D4ED8', '#B91C1C', '#C2410C', '#7C3AED', // allow-hex: swatch palette
  '#15803D', '#0F766E', '#B45309', '#9F1239', // allow-hex: swatch palette
] as const

export type SwatchHex = (typeof SWATCHES)[number]

interface ColorSwatchPickerProps {
  selected: string
  onSelect: (hex: string) => void
}

export function ColorSwatchPicker({ selected, onSelect }: ColorSwatchPickerProps) {
  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="grid grid-cols-4 gap-2">
        {SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            className={`w-6 h-6 rounded-full focus-visible:outline-none transition-shadow ${
              selected === hex
                ? 'ring-2 ring-foreground ring-offset-1'
                : 'hover:ring-2 hover:ring-foreground/40 hover:ring-offset-1'
            }`}
            style={{ backgroundColor: hex }}
            onClick={() => onSelect(hex)}
            aria-label={`Select color ${hex}`}
            aria-pressed={selected === hex}
          />
        ))}
      </div>
      <div className="border-t border-border pt-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          <input
            type="color"
            value={selected}
            onChange={(e) => onSelect(e.target.value)}
            className="sr-only"
          />
          Custom color…
        </label>
      </div>
    </div>
  )
}
