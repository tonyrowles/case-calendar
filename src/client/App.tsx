import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DeadlineForm } from './components/DeadlineForm.js'
import { CalendarView } from './components/calendar/CalendarView.js'
import { ListView } from './components/list/ListView.js'
import { FilterBar } from './components/filters/FilterBar.js'
import { useFilters } from './hooks/useFilters.js'
import { useDocumentTitle } from './hooks/useDocumentTitle.js'
import { applyFilters } from '@/shared/lib/filters.js'
import { getDeadlines } from './lib/api.js'
import { toISODateString } from '@/shared/lib/date.js'

export function App() {
  const [view, setView] = useState<'list' | 'calendar'>(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('cc-view') : null
    return stored === 'calendar' ? 'calendar' : 'list'
  })

  const [selectedDate, setSelectedDate] = useState<string>('')

  useEffect(() => {
    localStorage.setItem('cc-view', view)
  }, [view])

  function handleDateClick(dateStr: string) {
    // React 19 batches both setState calls into one render; DeadlineForm's selectedDate
    // effect fires AFTER the list-view DOM is mounted, so scrollIntoView and setFocus
    // resolve against the final layout.
    setSelectedDate(dateStr)
    setView('list')
  }

  const deadlinesQuery = useQuery({
    queryKey: ['deadlines'],
    queryFn: getDeadlines,
  })

  // new Date() no-arg is allowed — SAFE-03 guard narrows to string-arg forms only
  const todayStr = toISODateString(new Date())

  const { filters, clearAll, isDefault } = useFilters()

  const filteredDeadlines = useMemo(
    () => applyFilters(deadlinesQuery.data ?? [], filters, todayStr),
    [deadlinesQuery.data, filters, todayStr]
  )

  // VIEW-08: count is NOT filter-aware — always reflects all deadlines due today
  useDocumentTitle(deadlinesQuery.data, todayStr)

  const mainMaxWidth = view === 'list' ? 'max-w-2xl' : 'max-w-screen-xl'

  return (
    <div className="min-h-screen bg-background">
      <main className={`${mainMaxWidth} mx-auto px-4 py-12`}>
        <h1 className="text-2xl font-semibold mb-2">Case Calendar</h1>

        {/* FilterBar — sticky, above both views */}
        <FilterBar />

        {/* View toggle */}
        <div role="group" aria-label="View mode" className="inline-flex rounded-md border border-border overflow-hidden mt-2 mb-4">
          <button
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={view === 'list'
              ? 'h-9 px-4 text-sm bg-secondary text-foreground font-semibold border-r border-border'
              : 'h-9 px-4 text-sm bg-background text-muted-foreground font-normal hover:bg-muted/50 border-r border-border'}
          >List</button>
          <button
            type="button"
            aria-pressed={view === 'calendar'}
            onClick={() => setView('calendar')}
            className={view === 'calendar'
              ? 'h-9 px-4 text-sm bg-secondary text-foreground font-semibold'
              : 'h-9 px-4 text-sm bg-background text-muted-foreground font-normal hover:bg-muted/50'}
          >Calendar</button>
        </div>

        {view === 'list' ? (
          <>
            <section className="rounded-lg border bg-card p-6 shadow-sm">
              <DeadlineForm selectedDate={selectedDate} />
            </section>

            <ListView
              deadlines={filteredDeadlines}
              isLoading={deadlinesQuery.isLoading}
              isError={deadlinesQuery.isError}
              filtersActive={!isDefault}
              todayStr={todayStr}
            />
          </>
        ) : (
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <CalendarView
              onDateClick={handleDateClick}
              deadlines={filteredDeadlines}
              todayStr={todayStr}
            />
          </section>
        )}
      </main>
    </div>
  )
}

export default App
