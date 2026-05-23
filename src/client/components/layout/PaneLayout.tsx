import React from 'react'
import { useBreakpoint } from '@/client/hooks/useBreakpoint.js'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/client/components/ui/resizable.js'

export interface PaneLayoutProps {
  filterBar: React.ReactNode
  calendar: React.ReactNode
  list: React.ReactNode
  form: React.ReactNode
  view: 'list' | 'calendar'
  onViewChange: (v: 'list' | 'calendar') => void
}

function ViewToggle({
  view,
  onChange,
}: {
  view: 'list' | 'calendar'
  onChange: (v: 'list' | 'calendar') => void
}) {
  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex rounded-md border border-border overflow-hidden mt-2 mb-4"
    >
      <button
        type="button"
        aria-pressed={view === 'list'}
        onClick={() => onChange('list')}
        className={
          view === 'list'
            ? 'h-9 px-4 text-sm bg-secondary text-foreground font-semibold border-r border-border'
            : 'h-9 px-4 text-sm bg-background text-muted-foreground font-normal hover:bg-muted/50 border-r border-border'
        }
      >
        List
      </button>
      <button
        type="button"
        aria-pressed={view === 'calendar'}
        onClick={() => onChange('calendar')}
        className={
          view === 'calendar'
            ? 'h-9 px-4 text-sm bg-secondary text-foreground font-semibold'
            : 'h-9 px-4 text-sm bg-background text-muted-foreground font-normal hover:bg-muted/50'
        }
      >
        Calendar
      </button>
    </div>
  )
}

export function PaneLayout(props: PaneLayoutProps): React.JSX.Element {
  const { filterBar, calendar, list, form, view, onViewChange } = props
  const tier = useBreakpoint()

  if (tier === 'three') {
    return (
      <div className="flex flex-col h-full">
        {filterBar}
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="cc-pane-sizes"
          className="h-full flex-1"
        >
          <ResizablePanel defaultSize={40} minSize={20} maxSize={70}>
            {calendar}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={35} minSize={20} maxSize={70}>
            {list}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            defaultSize={25}
            minSize={20}
            maxSize={50}
            collapsible
            collapsedSize={0}
          >
            {form}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    )
  }

  if (tier === 'two') {
    return (
      <div className="flex flex-col h-full">
        {filterBar}
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="cc-pane-sizes-two"
          className="h-full flex-1"
        >
          <ResizablePanel defaultSize={75} minSize={30} maxSize={85}>
            <div className="flex flex-col h-full">
              <ViewToggle view={view} onChange={onViewChange} />
              {view === 'calendar' ? calendar : list}
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            defaultSize={25}
            minSize={20}
            maxSize={50}
            collapsible
            collapsedSize={0}
          >
            {form}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    )
  }

  // tier === 'one': Phase 4 single-column layout
  return (
    <div className="flex flex-col">
      {filterBar}
      <ViewToggle view={view} onChange={onViewChange} />
      <section className="rounded-lg border bg-card p-6 shadow-sm">{form}</section>
      {view === 'calendar' ? calendar : list}
    </div>
  )
}
