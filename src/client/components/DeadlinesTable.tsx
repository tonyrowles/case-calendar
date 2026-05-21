import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'

import { getDeadlines, getDeadlineTypes } from '@/client/lib/api.js'
import { parseLocalDate } from '@/shared/lib/date.js'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/client/components/ui/table.js'
import { EmptyState } from './EmptyState.js'

export function DeadlinesTable() {
  const deadlinesQuery = useQuery({
    queryKey: ['deadlines'],
    queryFn: getDeadlines,
  })

  const typesQuery = useQuery({
    queryKey: ['deadline-types'],
    queryFn: getDeadlineTypes,
  })

  const typeById = useMemo(
    () =>
      Object.fromEntries((typesQuery.data ?? []).map((t) => [t.id, t])),
    [typesQuery.data]
  )

  if (deadlinesQuery.isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">DATE</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">CASE</TableHead>
            <TableHead className="w-[180px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">TYPE</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">DESCRIPTION</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3].map((i) => (
            <TableRow key={i} className="h-12">
              <TableCell><div className="animate-pulse bg-muted rounded h-4 w-20 ml-auto" /></TableCell>
              <TableCell><div className="animate-pulse bg-muted rounded h-4 w-40" /></TableCell>
              <TableCell><div className="animate-pulse bg-muted rounded h-4 w-28" /></TableCell>
              <TableCell><div className="animate-pulse bg-muted rounded h-4 w-48" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  if (deadlinesQuery.isError) {
    return (
      <Table>
        <TableBody>
          <TableRow>
            <TableCell colSpan={4} className="text-destructive text-sm text-center py-8">
              Couldn't load deadlines. Refresh the page.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
  }

  if (!deadlinesQuery.data || deadlinesQuery.data.length === 0) {
    return <EmptyState />
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">DATE</TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">CASE</TableHead>
          <TableHead className="w-[180px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">TYPE</TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">DESCRIPTION</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deadlinesQuery.data.map((row) => {
          const parsedDate = parseLocalDate(row.date)
          const type = typeById[row.typeId]
          return (
            <TableRow
              key={row.id}
              className="h-12 hover:bg-muted/50 transition-colors"
            >
              <TableCell className="text-right text-sm">
                {parsedDate ? format(parsedDate, 'MMM d, yyyy') : row.date}
              </TableCell>
              <TableCell className="truncate text-sm">
                {row.caseLabel}
              </TableCell>
              <TableCell className="text-sm">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: type?.color ?? 'var(--muted-foreground)' }}
                    aria-hidden="true"
                  />
                  {type?.name ?? 'Unknown'}
                </span>
              </TableCell>
              <TableCell className="truncate max-w-xs text-sm">
                {row.description ? (
                  row.description
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
