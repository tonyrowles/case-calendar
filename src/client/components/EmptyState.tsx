import React from 'react'

export function EmptyState() {
  return (
    <div className="py-20 flex flex-col items-center justify-center text-center">
      <p className="text-sm font-semibold text-foreground">No deadlines yet.</p>
      <p className="text-sm text-muted-foreground">Create one above.</p>
    </div>
  )
}
