import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'

import { getDisplays, getSettings, updateSettings, type DisplayMonitor } from '@/client/lib/api.js'
import { autoIconColumns, type IconSide } from '@/shared/lib/wallpaper-layout.js'
import type { SettingsUpdate } from '@/shared/schemas/settings.js'
import { Button } from '@/client/components/ui/button.js'
import { cn } from '@/client/lib/utils.js'

function describe(m: DisplayMonitor, index: number): string {
  const scale = Math.round(m.scale * 100)
  return `Monitor ${index + 1}: ${m.width}×${m.height}${scale !== 100 ? ` at ${scale}%` : ''}${m.primary ? ' (primary)' : ''}`
}

/**
 * Settings > Wallpaper > Screen: which monitor shows the calendar (the others keep their
 * own wallpaper), and where to leave room for desktop icons. The wallpaper sizes itself
 * to the chosen monitor automatically.
 */
export function ScreenSettings(): React.JSX.Element {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const displaysQuery = useQuery({ queryKey: ['displays'], queryFn: () => getDisplays(), retry: false })
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (patch: SettingsUpdate) => updateSettings(patch),
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['displays'] })
    },
    onError: (err: Error) => setError(err.message),
  })
  const refresh = useMutation({
    mutationFn: () => getDisplays(true),
    onSuccess: data => queryClient.setQueryData(['displays'], data),
  })

  const settings = settingsQuery.data
  const displays = displaysQuery.data
  const monitors = displays?.monitors ?? []
  const target = displays?.target
  const side = settings?.wallpaperIconSide ?? 'left'
  const columns = settings?.wallpaperIconColumns ?? null
  const autoColumns = target ? autoIconColumns(target.logicalWidth) : null

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="space-y-1">
        <label htmlFor="wallpaper-monitor" className="text-sm font-semibold">Monitor</label>
        <div className="flex items-center gap-2">
          <select
            id="wallpaper-monitor"
            className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
            value={settings?.wallpaperMonitor ?? 'primary'}
            onChange={e => save.mutate({ wallpaperMonitor: e.target.value })}
            disabled={!settings}
          >
            <option value="primary">Primary monitor</option>
            {monitors.map((m, i) => <option key={m.id} value={m.id}>{describe(m, i)}</option>)}
          </select>
          <Button type="button" variant="ghost" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending} aria-label="Detect monitors again">
            <RefreshCw className={cn('size-4', refresh.isPending && 'animate-spin')} aria-hidden="true" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {target && target.monitorId
            ? `The calendar renders at ${Math.round(target.logicalWidth * target.deviceScaleFactor)}×${Math.round(target.logicalHeight * target.deviceScaleFactor)} on this monitor; other monitors keep their wallpaper.`
            : displaysQuery.isLoading ? 'Detecting monitors…' : 'Monitors could not be detected; the wallpaper is applied to all monitors.'}
        </p>
      </div>

      <div className="space-y-1">
        <span className="text-sm font-semibold">Desktop icons</span>
        <div className="flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Desktop icon side" className="inline-flex rounded-md border overflow-hidden">
            {(['left', 'right', 'none'] as IconSide[]).map(s => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={side === s}
                onClick={() => save.mutate({ wallpaperIconSide: s })}
                className={cn('h-8 px-3 text-sm border-r last:border-r-0', side === s ? 'bg-secondary font-semibold' : 'bg-background text-muted-foreground hover:bg-muted/50')}
              >
                {s === 'none' ? 'No icons' : s === 'left' ? 'Left' : 'Right'}
              </button>
            ))}
          </div>
          {side !== 'none' && (
            <label className="flex items-center gap-2 text-sm">
              Columns to keep clear
              <select
                aria-label="Icon columns to keep clear"
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                value={columns === null ? 'auto' : String(columns)}
                onChange={e => save.mutate({ wallpaperIconColumns: e.target.value === 'auto' ? null : Number(e.target.value) })}
              >
                <option value="auto">Automatic{autoColumns !== null ? ` (${autoColumns})` : ''}</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Leaves an empty strip where Windows puts desktop icons.</p>
      </div>
    </div>
  )
}
