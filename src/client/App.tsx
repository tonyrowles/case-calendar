import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DeadlineForm } from './components/DeadlineForm.js'
import { CalendarView } from './components/calendar/CalendarView.js'
import type { CalendarViewHandle } from './components/calendar/CalendarView.js'
import { ListView } from './components/list/ListView.js'
import { FilterBar } from './components/filters/FilterBar.js'
import { PaneLayout } from './components/layout/PaneLayout.js'
import { ShortcutsDialog } from './components/help/ShortcutsDialog.js'
import { CommandPaletteShell } from './components/help/CommandPaletteShell.js'
import { useFilters } from './hooks/useFilters.js'
import { useDeadlineMutations } from './hooks/useDeadlineMutations.js'
import { useDocumentTitle } from './hooks/useDocumentTitle.js'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'
import { applyFilters } from '@/shared/lib/filters.js'
import { getDeadlines } from './lib/api.js'
import { toISODateString } from '@/shared/lib/date.js'

export function App() {
  const [view, setView] = useState<'list' | 'calendar'>(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('cc-view') : null
    return stored === 'calendar' ? 'calendar' : 'list'
  })

  const [selectedDate, setSelectedDate] = useState<string>('')

  // Phase 4: selectedDeadlineId — when set, DeadlineForm enters edit mode
  const [selectedDeadlineId, setSelectedDeadlineId] = useState<number | null>(null)

  // Phase 5: keyboard navigation index + help/palette open state
  const [selectedDeadlineIndex, setSelectedDeadlineIndex] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [commandKOpen, setCommandKOpen] = useState(false)
  const [deleteTriggerSignal, setDeleteTriggerSignal] = useState<{ id: number; nonce: number } | null>(null)

  // Phase 5: imperative ref to CalendarView for 't' shortcut
  const calendarRef = useRef<CalendarViewHandle>(null)

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

  // Phase 4: centralized mutations for edit/delete operations
  const mutations = useDeadlineMutations()

  const filteredDeadlines = useMemo(
    () => applyFilters(deadlinesQuery.data ?? [], filters, todayStr),
    [deadlinesQuery.data, filters, todayStr]
  )

  // Phase 5: synchronize selectedDeadlineIndex with filteredDeadlines when list or selection changes.
  // If the previously selected id is still in the list, point to its new position.
  // If not found and list is non-empty, reset to 0. If list is empty, reset to null.
  useEffect(() => {
    if (selectedDeadlineId === null) {
      setSelectedDeadlineIndex(null)
      return
    }
    const newIdx = filteredDeadlines.findIndex(d => d.id === selectedDeadlineId)
    if (newIdx !== -1) {
      setSelectedDeadlineIndex(newIdx)
    } else {
      // Selected item is no longer in filteredDeadlines (filtered out or deleted).
      // Clear BOTH pieces of state so DeadlineForm returns to create mode rather than
      // silently loading filteredDeadlines[0] into edit mode (CR-01).
      setSelectedDeadlineIndex(null)
      setSelectedDeadlineId(null)
    }
  }, [filteredDeadlines, selectedDeadlineId])

  // Phase 5: selectedDeadline resolved by index (replaces Phase 4 id-based lookup).
  // DeadlineForm still shows the selected deadline; the index is the canonical highlight key.
  const selectedDeadline = useMemo(
    () => selectedDeadlineIndex !== null ? (filteredDeadlines[selectedDeadlineIndex] ?? null) : null,
    [filteredDeadlines, selectedDeadlineIndex]
  )

  // VIEW-08: count is NOT filter-aware — always reflects all deadlines due today
  useDocumentTitle(deadlinesQuery.data, todayStr)

  // Phase 5: helper that sets both id and index atomically.
  // Pass id=-1 as sentinel to clear selection.
  const selectDeadline = useCallback((id: number) => {
    if (id === -1) {
      setSelectedDeadlineId(null)
      setSelectedDeadlineIndex(null)
      return
    }
    setSelectedDeadlineId(id)
    setSelectedDeadlineIndex(filteredDeadlines.findIndex(d => d.id === id))
  }, [filteredDeadlines])

  // ── Keyboard handlers ────────────────────────────────────────────────────────

  // KBD-01: 'n' — open new-deadline form; DeadlineForm's existing effect focuses caseLabel when
  // the deadline prop transitions from truthy → null.
  const onNewDeadline = useCallback(() => {
    setSelectedDeadlineId(null)
    setSelectedDeadlineIndex(null)
  }, [])

  // KBD-02: 'e' — edit selected; form is already in edit mode when selectedDeadline is non-null.
  // Scroll-into-view polish is deferred to Phase 7.
  const onEditSelected = useCallback(() => {
    // no-op when nothing selected; affordance only — form already shows the selected deadline
  }, [])

  // KBD-03: 'Delete' — prime the 2-step delete on the selected row via deleteTriggerSignal.
  const onDeleteSelected = useCallback(() => {
    if (selectedDeadlineIndex === null) return
    const id = filteredDeadlines[selectedDeadlineIndex]?.id
    if (id != null) {
      setDeleteTriggerSignal({ id, nonce: Date.now() })
    }
  }, [selectedDeadlineIndex, filteredDeadlines])

  // KBD-04: 't' — jump calendar to today. If calendar is not mounted (tier='one', view='list'),
  // switch to calendar view first; user can press 't' again once it mounts.
  const onJumpToday = useCallback(() => {
    if (calendarRef.current) {
      calendarRef.current.jumpToToday()
    } else {
      // Calendar not mounted; switch to calendar view so it mounts on next render
      setView('calendar')
    }
  }, [])

  // KBD-05: 'j' — advance selection by one, clamped at list top boundary.
  const onMoveNext = useCallback(() => {
    if (filteredDeadlines.length === 0) return
    setSelectedDeadlineIndex(prev => {
      const newIdx = prev === null ? 0 : Math.min(prev + 1, filteredDeadlines.length - 1)
      setSelectedDeadlineId(filteredDeadlines[newIdx]?.id ?? null)
      return newIdx
    })
  }, [filteredDeadlines])

  // KBD-05: 'k' — advance selection by one backward, clamped at 0.
  const onMovePrev = useCallback(() => {
    if (filteredDeadlines.length === 0) return
    setSelectedDeadlineIndex(prev => {
      const newIdx = prev === null ? 0 : Math.max(prev - 1, 0)
      setSelectedDeadlineId(filteredDeadlines[newIdx]?.id ?? null)
      return newIdx
    })
  }, [filteredDeadlines])

  // KBD-07: '?' — open shortcuts dialog.
  const onOpenHelp = useCallback(() => {
    setHelpOpen(true)
  }, [])

  // KBD-09: Cmd+K / Ctrl+K — open command palette.
  const onOpenCommandK = useCallback(() => {
    setCommandKOpen(true)
  }, [])

  // Mount keyboard shortcuts hook with all handlers
  useKeyboardShortcuts({
    onNewDeadline,
    onEditSelected,
    onDeleteSelected,
    onJumpToday,
    onMoveNext,
    onMovePrev,
    onOpenHelp,
    onOpenCommandK,
  })

  // ── Slot content ─────────────────────────────────────────────────────────────

  const calendarSlot = (
    <section className="rounded-lg border bg-card p-4 shadow-sm h-full">
      <CalendarView
        ref={calendarRef}
        onDateClick={handleDateClick}
        deadlines={filteredDeadlines}
        todayStr={todayStr}
        onEventClick={(id) => selectDeadline(id === selectedDeadlineId ? -1 : id)}
      />
    </section>
  )

  const listSlot = (
    <ListView
      deadlines={filteredDeadlines}
      isLoading={deadlinesQuery.isLoading}
      isError={deadlinesQuery.isError}
      filtersActive={!isDefault}
      todayStr={todayStr}
      onRowClick={(id) => selectDeadline(id === selectedDeadlineId ? -1 : id)}
      onComplete={(id, completed) => mutations.update.mutate({
        id,
        patch: { completedAt: completed ? new Date().toISOString() : null },
      })}
      onDelete={(id, onError) => {
        mutations.remove.mutate(id, { onError })
        if (id === selectedDeadlineId) {
          setSelectedDeadlineId(null)
          setSelectedDeadlineIndex(null)
        }
      }}
      selectedDeadlineId={selectedDeadlineId}
      deleteTriggerSignal={deleteTriggerSignal}
    />
  )

  const formSlot = (
    <section className="rounded-lg border bg-card p-6 shadow-sm h-full overflow-auto">
      <DeadlineForm
        selectedDate={selectedDate}
        deadline={selectedDeadline}
        onCancel={() => {
          setSelectedDeadlineId(null)
          setSelectedDeadlineIndex(null)
        }}
        onSuccess={() => {
          setSelectedDeadlineId(null)
          setSelectedDeadlineIndex(null)
        }}
      />
    </section>
  )

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto px-4 py-6 max-w-[7680px]">
        <div className="flex items-baseline justify-between mb-2">
          <h1 className="text-2xl font-semibold">Case Calendar</h1>
          <Link
            to="/settings"
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
          >
            Settings
          </Link>
        </div>

        <PaneLayout
          filterBar={<FilterBar />}
          view={view}
          onViewChange={setView}
          calendar={calendarSlot}
          list={listSlot}
          form={formSlot}
        />

        {/* Dialogs mount unconditionally — Radix portals content only when open */}
        <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
        <CommandPaletteShell open={commandKOpen} onOpenChange={setCommandKOpen} />
      </main>
    </div>
  )
}

export default App
