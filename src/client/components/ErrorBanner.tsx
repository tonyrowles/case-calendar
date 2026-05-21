import React from 'react'
import { AlertCircle, X } from 'lucide-react'

interface ErrorBannerProps {
  message: string
  onDismiss: () => void
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-destructive text-sm flex items-start gap-2"
    >
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        aria-label="Dismiss error"
        onClick={onDismiss}
        className="hover:bg-destructive/20 rounded p-1 -m-1"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
