import React from 'react'
import { useDefaultLayout } from 'react-resizable-panels'
import { useBreakpoint } from '@/client/hooks/useBreakpoint.js'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/client/components/ui/resizable.js'

// The calendar view was removed: the desktop wallpaper is the calendar. The app is the
// deadline list plus the add/edit form.
export interface PaneLayoutProps {
  filterBar: React.ReactNode
  list: React.ReactNode
  form: React.ReactNode
}

// New storage id: layouts saved for the old 3-pane (calendar | list | form) arrangement
// would not fit two panels.
const PANE_SIZES_ID = 'cc-pane-sizes-list-form'

export function PaneLayout({ filterBar, list, form }: PaneLayoutProps): React.JSX.Element {
  const tier = useBreakpoint()

  // Layout persistence: useDefaultLayout reads the saved layout from localStorage on mount
  // and provides onLayoutChanged to write on change (called unconditionally: rules of hooks).
  const saved = useDefaultLayout({ id: PANE_SIZES_ID })

  if (tier === 'one') {
    // Narrow screens: single column, form above the list
    return (
      <div className="flex flex-col gap-4">
        {filterBar}
        <section className="rounded-lg border bg-card p-6 shadow-sm">{form}</section>
        {list}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {filterBar}
      <ResizablePanelGroup
        direction="horizontal"
        autoSaveId={PANE_SIZES_ID}
        defaultLayout={saved.defaultLayout}
        onLayoutChanged={saved.onLayoutChanged}
        className="h-full flex-1"
      >
        <ResizablePanel defaultSize={68} minSize={40} maxSize={85}>
          {list}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={32} minSize={15} maxSize={60} collapsible collapsedSize={0}>
          {form}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
