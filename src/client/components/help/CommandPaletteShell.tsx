import React, { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog.js'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
} from '@/client/components/ui/command.js'
import { parseDeadline, ApiError, type ParsedDeadlineResult } from '@/client/lib/api.js'

export interface CommandPaletteShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onParsed?: (result: ParsedDeadlineResult) => void
}

/**
 * Maps an API error code to a user-facing message displayed inline in the palette.
 * Palette stays open on error so the user can edit and retry.
 */
function mapErrorMessage(code: string, fallback: string): string {
  switch (code) {
    case 'parser_unconfigured': return 'NL parser disabled — see docs/DEPLOYMENT.md#nl-quick-add-phase-11'
    case 'parser_timeout':      return 'Parser timed out. Try again.'
    case 'parse_failed':        return "Couldn't parse — try rewording."
    case 'validation_failed':   return fallback   // server's own message (e.g., "text must be 1-500 chars")
    default:                    return fallback || 'Parser unreachable. Try again.'
  }
}

export function CommandPaletteShell(props: CommandPaletteShellProps): React.JSX.Element {
  const [inputValue, setInputValue] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)

  const parseMutation = useMutation({
    mutationFn: (text: string) => parseDeadline(text),
    onSuccess: (result) => {
      setParseError(null)
      setInputValue('')
      props.onParsed?.(result)
      props.onOpenChange(false)
    },
    onError: (err: Error) => {
      const code = err instanceof ApiError ? err.code : 'unknown'
      setParseError(mapErrorMessage(code, err.message))
      // Palette stays open — DO NOT call onOpenChange(false) here.
      // inputValue is preserved so user can edit and retry.
    },
  })

  // Reset on close so reopening after a close starts fresh.
  // parseMutation.reset() prevents an in-flight parse from calling onParsed after
  // the palette is dismissed (WR-02: ghost-parse scenario where user presses Esc
  // before the response arrives — without reset(), onSuccess still fires and opens
  // the form unexpectedly). Note: reset() stops the TanStack state machine but does
  // not abort the underlying HTTP request; the server-side parse still completes.
  useEffect(() => {
    if (!props.open) {
      setInputValue('')
      setParseError(null)
      parseMutation.reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      const trimmed = inputValue.trim()
      if (!trimmed) return                           // 11-03-04: empty input does nothing
      if (parseMutation.isPending) return            // Prevent double-fire
      e.preventDefault()                             // RESEARCH.md Pitfall 3: prevent cmdk default
      setParseError(null)
      parseMutation.mutate(trimmed)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="overflow-hidden p-0 max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Quick command</DialogTitle>
        </DialogHeader>
        {/* shouldFilter={false}: CRITICAL — without this, cmdk intercepts Enter to select CommandItems */}
        <Command shouldFilter={false} data-testid="cmdk-shell-root">
          <CommandInput
            placeholder='e.g., "Smith deposition June 15"'
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={handleKeyDown}
          />
          <CommandList>
            {parseMutation.isPending && (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Parsing…</span>
              </div>
            )}
            {!parseMutation.isPending && parseError && (
              <div className="px-4 py-3 text-sm text-destructive" role="alert">{parseError}</div>
            )}
            {!parseMutation.isPending && !parseError && inputValue && (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                Press Enter to parse
              </div>
            )}
            {!parseMutation.isPending && !parseError && !inputValue && (
              <CommandEmpty>Type a deadline to parse</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
