import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Check, Copy, Calendar } from 'lucide-react'
import { Button } from '@/client/components/ui/button.js'

// Port locked per SAFE-07: 127.0.0.1:3747 only — do not parameterize.
const WEBCAL_URL = 'webcal://localhost:3747/api/deadlines.ics'

export function SubscribeIcalItem(): React.JSX.Element {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  // Timeout cleanup ref — prevent state updates on unmounted component
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear any pending timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  const handleCopy = useCallback(async () => {
    // Cancel any pending revert timer before starting a new copy
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    try {
      await navigator.clipboard.writeText(WEBCAL_URL)
      setCopyStatus('copied')
      // Revert to idle after 2 seconds
      timeoutRef.current = setTimeout(() => setCopyStatus('idle'), 2000)
    } catch {
      setCopyStatus('failed')
      // Revert to idle after 5 seconds
      timeoutRef.current = setTimeout(() => setCopyStatus('idle'), 5000)
    }
  }, [])

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />

      <div className="flex-1 min-w-0" id="subscribe-ical-desc">
        <p className="text-sm font-medium text-foreground">Subscribe (iCal)</p>
        <p className="text-xs text-muted-foreground">
          Copy the webcal:// link to subscribe in Outlook or Apple Calendar
        </p>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        aria-label={copyStatus === 'copied' ? 'Link copied' : 'Copy iCal subscription link'}
        aria-describedby="subscribe-ical-desc"
      >
        {copyStatus === 'copied' ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>

      {/* aria-live region for screen reader announcement */}
      <span aria-live="polite" className="sr-only">
        {copyStatus === 'copied' ? 'Copied!' : copyStatus === 'failed' ? 'Copy failed' : ''}
      </span>

      {/* Failure fallback: show the raw URL for manual copy */}
      {copyStatus === 'failed' && (
        <p className="text-xs text-muted-foreground mt-1 break-all">{WEBCAL_URL}</p>
      )}
    </div>
  )
}
