import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getDeadlineTypes } from '@/client/lib/api.js'
import { TypeListItem } from '@/client/components/settings/TypeListItem.js'
import { AddTypeRow } from '@/client/components/settings/AddTypeRow.js'

export function SettingsPage() {
  const typesQuery = useQuery({
    queryKey: ['deadline-types'],
    queryFn: getDeadlineTypes,
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link
        to="/"
        className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline mb-6 block transition-colors"
      >
        ← Case Calendar
      </Link>

      <h2 className="text-2xl font-semibold mb-8">Settings</h2>

      <section>
        <h3 className="text-xl font-semibold mb-4">Deadline Types</h3>

        {typesQuery.isError && (
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm text-destructive">
              Couldn't load deadline types. Refresh the page.
            </p>
          </div>
        )}

        {typesQuery.isLoading && (
          <div className="rounded-lg border bg-card overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 flex items-center gap-3 px-4 border-b border-border last:border-0"
              >
                <div className="animate-pulse bg-muted rounded-full w-3 h-3" />
                <div className="animate-pulse bg-muted rounded h-4 w-32" />
              </div>
            ))}
          </div>
        )}

        {!typesQuery.isLoading && !typesQuery.isError && (
          <div className="rounded-lg border bg-card overflow-hidden">
            {(typesQuery.data ?? []).map((t) => (
              <TypeListItem key={t.id} id={t.id} name={t.name} color={t.color} />
            ))}
            <AddTypeRow />
          </div>
        )}
      </section>
    </div>
  )
}

export default SettingsPage
