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
import { JumpToDateDialog } from './components/JumpToDateDialog.js'
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
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false)
  const [deleteTriggerSignal, setDeleteTriggerSignal] = useState<{ id: number; nonce: number } | null>(null)

  // POLISH-04: duplicate source — when set, DeadlineForm receives prefillValues
  const [duplicateSource, setDuplicateSource] = useState<import('@/shared/schemas/deadline.js').Deadline | null>(null)

  // Phase 11 NL-01/NL-03: nlSource — when set, DeadlineForm receives prefillValues from the NL parser.
  // Mirrors duplicateSource pattern (POLISH-04); nlSource takes precedence in the merged prefillValues.
  const [nlSource, setNlSource] = useState<import('./lib/api.js').ParsedDeadlineResult | null>(null)

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
  // Also clears duplicateSource and nlSource so 'n' always opens a blank form (WR-02 + NL-01 mutual exclusion).
  const onNewDeadline = useCallback(() => {
    setSelectedDeadlineId(null)
    setSelectedDeadlineIndex(null)
    setDuplicateSource(null)
    setNlSource(null)
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

  // POLISH-02: 'g' — open jump-to-date dialog.
  const onJumpToDate = useCallback(() => {
    setJumpDialogOpen(true)
  }, [])

  // POLISH-04: lookup the source deadline by id and set as duplicate source.
  const onDuplicate = useCallback((id: number) => {
    const source = deadlinesQuery.data?.find(d => d.id === id) ?? null
    setDuplicateSource(source)
  }, [deadlinesQuery.data])

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
    onJumpToDate,
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
        onDuplicate={onDuplicate}
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
      onDuplicate={onDuplicate}
    />
  )

  // Memoize so the object reference is stable across re-renders (TanStack refetch, filter change, etc.).
  // Without this, DeadlineForm's useEffect([prefillValues]) re-fires on every App render, stealing
  // focus from whatever the user is typing (CR-02). nlSource takes precedence over duplicateSource
  // so both sources are mutually exclusive in the form (RESEARCH.md Pitfall 6).
  const prefillValues = useMemo(
    () => {
      if (nlSource) return {
        date: nlSource.date,
        caseLabel: nlSource.caseLabel,
        typeId: nlSource.typeId,
        description: nlSource.description ?? '',
      }
      if (duplicateSource) return {
        date: duplicateSource.date,
        caseLabel: duplicateSource.caseLabel,
        typeId: duplicateSource.typeId,
        description: duplicateSource.description ?? '',
      }
      return undefined
    },
    [nlSource, duplicateSource]
  )

  const formSlot = (
    <section className="rounded-lg border bg-card p-6 shadow-sm h-full overflow-auto">
      {/* Phase 11 NL-03: amber "Review & save" banner — visible only when nlSource is active.
          LLM output never auto-saves; user must review and click Save. */}
      {nlSource && (
        <div
          className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="status"
          aria-live="polite"
        >
          Review &amp; save — parsed values may need adjustment before saving.
        </div>
      )}
      <DeadlineForm
        selectedDate={selectedDate}
        deadline={selectedDeadline}
        prefillValues={prefillValues}
        onCancel={() => {
          setSelectedDeadlineId(null)
          setSelectedDeadlineIndex(null)
          setDuplicateSource(null)
          setNlSource(null)
        }}
        onSuccess={() => {
          setSelectedDeadlineId(null)
          setSelectedDeadlineIndex(null)
          setDuplicateSource(null)
          setNlSource(null)
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
        <CommandPaletteShell
          open={commandKOpen}
          onOpenChange={setCommandKOpen}
          onParsed={(parsed) => {
            // NL takes precedence; clear duplicateSource so prefillValues sources are mutually
            // exclusive (RESEARCH.md Pitfall 6). Also clear any selected deadline so the form
            // returns to create mode rather than edit mode.
            setDuplicateSource(null)
            setNlSource(parsed)
            setSelectedDeadlineId(null)
            setSelectedDeadlineIndex(null)
            // Palette closes itself via onOpenChange(false) inside CommandPaletteShell.onSuccess
          }}
        />
        <JumpToDateDialog
          open={jumpDialogOpen}
          onOpenChange={setJumpDialogOpen}
          onDateSelect={(isoDateStr) => {
            setJumpDialogOpen(false)
            calendarRef.current?.jumpToDate(isoDateStr)
          }}
        />
      </main>
    </div>
  )
}

export default App
