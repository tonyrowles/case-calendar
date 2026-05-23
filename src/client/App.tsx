import React, { useState, useEffect } from 'react'
import { DeadlineForm } from './components/DeadlineForm.js'
import { DeadlinesTable } from './components/DeadlinesTable.js'
import { CalendarView } from './components/calendar/CalendarView.js'

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

  const mainMaxWidth = view === 'list' ? 'max-w-2xl' : 'max-w-screen-xl'

  return (
    <div className="min-h-screen bg-background">
      <main className={`${mainMaxWidth} mx-auto px-4 py-12`}>
        <h1 className="text-2xl font-semibold mb-2">Case Calendar</h1>

        {/* View toggle */}
        <div role="group" aria-label="View mode" className="inline-flex rounded-md border border-border overflow-hidden mt-2 mb-6">
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

            <section className="rounded-lg border bg-card mt-8">
              <h2 className="text-xl font-semibold px-4 pt-4 pb-2">Saved Deadlines</h2>
              <DeadlinesTable />
            </section>
          </>
        ) : (
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <CalendarView onDateClick={handleDateClick} />
          </section>
        )}
      </main>
    </div>
  )
}

export default App
