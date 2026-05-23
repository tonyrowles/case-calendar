import React, { useState, useCallback } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { Input } from '@/client/components/ui/input.js'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/client/components/ui/popover.js'
import { ColorSwatchPicker } from './ColorSwatchPicker.js'
import { useDeadlineTypeMutations } from '@/client/hooks/useDeadlineTypeMutations.js'
import type { ApiError } from '@/client/lib/api.js'

interface TypeListItemProps {
  id: number
  name: string
  color: string
}

export function TypeListItem({ id, name, color }: TypeListItemProps) {
  const mutations = useDeadlineTypeMutations()

  // --- Rename state ---
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(name)
  const [renameError, setRenameError] = useState<string | null>(null)

  // --- Color picker state ---
  const [pickerOpen, setPickerOpen] = useState(false)

  // --- Delete / general error state ---
  const [error, setError] = useState<string | null>(null)

  const startRename = useCallback(() => {
    setRenameValue(name)
    setRenameError(null)
    setIsRenaming(true)
  }, [name])

  const handleRenameCommit = useCallback(() => {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === name) {
      setIsRenaming(false)
      setRenameValue(name)
      return
    }
    mutations.update.mutate(
      { id, patch: { name: trimmed } },
      {
        onSuccess: () => {
          setIsRenaming(false)
        },
        onError: (err) => {
          const apiErr = err as ApiError
          setRenameError(apiErr.message ?? 'Couldn\'t save. Try again.')
          setIsRenaming(false)
        },
      }
    )
  }, [id, name, renameValue, mutations.update])

  const handleRenameCancel = useCallback(() => {
    setIsRenaming(false)
    setRenameValue(name)
    setRenameError(null)
  }, [name])

  const handleRecolor = useCallback(
    (hex: string) => {
      setPickerOpen(false)
      mutations.update.mutate(
        { id, patch: { color: hex } },
        {
          onError: (err) => {
            const apiErr = err as ApiError
            setError(apiErr.message ?? 'Couldn\'t save color. Try again.')
          },
        }
      )
    },
    [id, mutations.update]
  )

  const handleDelete = useCallback(() => {
    setError(null)
    mutations.remove.mutate(id, {
      onError: (err) => {
        const apiErr = err as ApiError
        setError(apiErr.message ?? 'Couldn\'t delete. Check your connection and try again.')
      },
    })
  }, [id, mutations.remove])

  return (
    <>
      <div
        className="group flex items-center h-12 gap-3 px-4 border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
      >
        {/* Color dot — clickable to recolor */}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-3 h-3 rounded-full shrink-0 ring-offset-1 hover:ring-2 hover:ring-foreground/50 transition-shadow focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
              style={{ backgroundColor: color }}
              aria-label={`Change color for ${name}`}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <ColorSwatchPicker selected={color} onSelect={handleRecolor} />
          </PopoverContent>
        </Popover>

        {/* Name — display or inline rename input */}
        {isRenaming ? (
          <Input
            key={`rename-${id}`}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleRenameCommit()
              }
              if (e.key === 'Escape') handleRenameCancel()
            }}
            autoFocus
            className="h-8 flex-1 text-sm"
            aria-label={`Rename type ${name}`}
            autoComplete="off"
          />
        ) : (
          <span
            className="flex-1 text-sm text-foreground cursor-pointer hover:underline underline-offset-2"
            onClick={startRename}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') startRename()
            }}
            aria-label={`Rename type ${name}`}
          >
            {name}
          </span>
        )}

        {/* Delete button — hover only */}
        <button
          type="button"
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2 text-sm text-muted-foreground hover:text-destructive rounded"
          onClick={handleDelete}
          aria-label={`Delete type ${name}`}
          disabled={mutations.remove.isPending}
        >
          Delete
        </button>
      </div>

      {/* Inline error banner (rename or delete errors) */}
      {(error || renameError) && (
        <div
          role="alert"
          className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/30 text-destructive text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{error ?? renameError}</span>
          <button
            type="button"
            onClick={() => { setError(null); setRenameError(null) }}
            className="text-destructive hover:text-destructive/70"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  )
}
