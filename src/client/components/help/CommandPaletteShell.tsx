import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog.js'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
} from '@/client/components/ui/command.js'

export interface CommandPaletteShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPaletteShell(props: CommandPaletteShellProps): React.JSX.Element {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="overflow-hidden p-0 max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Quick command</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Quick command…" />
          <CommandList>
            <CommandEmpty>No suggestions yet — Phase 11 wires this in.</CommandEmpty>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
