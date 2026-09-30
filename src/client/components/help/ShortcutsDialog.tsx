import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog.js'

export interface ShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const KBD_CLASS = 'inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-mono bg-muted'

export function ShortcutsDialog(props: ShortcutsDialogProps): React.JSX.Element {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td><kbd className={KBD_CLASS}>n</kbd></td>
              <td className="pl-3 text-muted-foreground">Add deadline</td>
            </tr>
            <tr>
              <td><kbd className={KBD_CLASS}>e</kbd></td>
              <td className="pl-3 text-muted-foreground">Edit selected</td>
            </tr>
            <tr>
              <td><kbd className={KBD_CLASS}>Delete</kbd></td>
              <td className="pl-3 text-muted-foreground">Delete selected (2-step)</td>
            </tr>
            <tr>
              <td>
                <kbd className={KBD_CLASS}>j</kbd>
                {' / '}
                <kbd className={KBD_CLASS}>k</kbd>
              </td>
              <td className="pl-3 text-muted-foreground">Next / previous deadline</td>
            </tr>
            <tr>
              <td><kbd className={KBD_CLASS}>?</kbd></td>
              <td className="pl-3 text-muted-foreground">Show this help</td>
            </tr>
            <tr>
              <td>
                <kbd className={KBD_CLASS}>⌘K</kbd>
                {' / '}
                <kbd className={KBD_CLASS}>Ctrl+K</kbd>
              </td>
              <td className="pl-3 text-muted-foreground">Command palette</td>
            </tr>
            <tr>
              <td><kbd className={KBD_CLASS}>Esc</kbd></td>
              <td className="pl-3 text-muted-foreground">Close any dialog</td>
            </tr>
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  )
}
