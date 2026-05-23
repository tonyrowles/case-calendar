import React, { useState, useCallback } from 'react'
import { AlertCircle, Loader2, X } from 'lucide-react'
import { Button } from '@/client/components/ui/button.js'
import { Input } from '@/client/components/ui/input.js'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/client/components/ui/popover.js'
import { ColorSwatchPicker, SWATCHES } from './ColorSwatchPicker.js'
import { useDeadlineTypeMutations } from '@/client/hooks/useDeadlineTypeMutations.js'
import type { ApiError } from '@/client/lib/api.js'

export function AddTypeRow() {
  const mutations = useDeadlineTypeMutations()
  const [name, setName] = useState('')
  const [selectedColor, setSelectedColor] = useState<string>(SWATCHES[0])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const isSaving = mutations.create.isPending

  const handleAdd = useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed || isSaving) return
    setAddError(null)
    mutations.create.mutate(
      { name: trimmed, color: selectedColor },
      {
        onSuccess: () => {
          setName('')
          setSelectedColor(SWATCHES[0])
        },
        onError: (err) => {
          const apiErr = err as ApiError
          if (apiErr.code === 'type_name_taken') {
            setAddError('A type with that name already exists.')
          } else {
            setAddError(apiErr.message ?? 'Save failed. Check your connection and try again.')
          }
        },
      }
    )
  }, [name, selectedColor, isSaving, mutations.create])

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-card">
        <Input
          placeholder="Type name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 h-8 text-sm"
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          aria-label="New type name"
        />

        {/* Swatch trigger button */}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-6 h-6 rounded-full shrink-0 border border-border hover:ring-2 hover:ring-foreground/50 transition-shadow focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
              style={{ backgroundColor: selectedColor }}
              aria-label="Choose color"
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <ColorSwatchPicker
              selected={selectedColor}
              onSelect={(hex) => {
                setSelectedColor(hex)
                setPickerOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          size="sm"
          disabled={!name.trim() || isSaving}
          onClick={handleAdd}
          className="h-8 px-3 text-sm"
        >
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            'Add'
          )}
        </Button>
      </div>

      {addError && (
        <div
          role="alert"
          className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-t border-destructive/30 text-destructive text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{addError}</span>
          <button
            type="button"
            onClick={() => setAddError(null)}
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  )
}
