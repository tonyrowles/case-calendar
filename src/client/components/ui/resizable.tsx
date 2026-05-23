import * as React from "react"
import { GripVertical } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/client/lib/utils"

const ResizablePanelGroup = ({
  className,
  autoSaveId,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  direction?: "horizontal" | "vertical"
  autoSaveId?: string
}) => {
  // v2 uses `id` prop for storage identification (via useDefaultLayout).
  // We pass autoSaveId as the `id` so consumers can continue using the same prop name
  // and the id is available on the DOM element for tests.
  return (
    <ResizablePrimitive.Group
      className={cn(
        "flex h-full w-full",
        props.direction === "vertical" ? "flex-col" : "",
        className
      )}
      id={autoSaveId}
      {...(props as React.ComponentProps<typeof ResizablePrimitive.Group>)}
    />
  )
}

const ResizablePanel = ResizablePrimitive.Panel

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  withHandle?: boolean
}) => (
  <ResizablePrimitive.Separator
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1",
      className
    )}
    {...(props as React.ComponentProps<typeof ResizablePrimitive.Separator>)}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </ResizablePrimitive.Separator>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
