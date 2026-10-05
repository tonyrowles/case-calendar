import React, { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ImageUp, Trash2 } from 'lucide-react'

import {
  deleteWallpaperBackground,
  getSettings,
  updateSettings,
  uploadWallpaperBackground,
  wallpaperBackgroundUrl,
} from '@/client/lib/api.js'
import {
  WALLPAPER_THEME_IDS,
  WALLPAPER_THEMES,
  glassCanvasWithImage,
  type WallpaperThemeId,
} from '@/shared/lib/wallpaper-themes.js'
import { Button } from '@/client/components/ui/button.js'
import { cn } from '@/client/lib/utils.js'

const ACCEPT = 'image/jpeg,image/png,image/webp'

/**
 * Settings > Wallpaper: theme choice (Light / Dark / Glass) and, for Glass, an
 * optional uploaded background image. Every change re-renders the desktop wallpaper.
 */
export function WallpaperSettings(): React.JSX.Element {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const onDone = {
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (err: Error) => setError(err.message),
  }
  const themeMutation = useMutation({ mutationFn: (id: WallpaperThemeId) => updateSettings({ wallpaperTheme: id }), ...onDone })
  const uploadMutation = useMutation({ mutationFn: uploadWallpaperBackground, ...onDone })
  const removeMutation = useMutation({ mutationFn: deleteWallpaperBackground, ...onDone })

  if (settingsQuery.isError) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <p className="text-sm text-destructive">Couldn't load wallpaper settings. Refresh the page.</p>
      </div>
    )
  }

  const current = settingsQuery.data?.wallpaperTheme
  const background = settingsQuery.data?.wallpaperBackground ?? null
  const busy = uploadMutation.isPending || removeMutation.isPending

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div role="radiogroup" aria-label="Wallpaper theme" className="grid grid-cols-3 gap-3">
        {WALLPAPER_THEME_IDS.map(id => {
          const theme = WALLPAPER_THEMES[id]
          const selected = id === current
          const canvas = id === 'glass' && background ? glassCanvasWithImage(wallpaperBackgroundUrl(background.version)) : theme.canvas
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={settingsQuery.isLoading}
              onClick={() => { if (!selected) themeMutation.mutate(id) }}
              className={cn(
                'rounded-lg border-2 p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'border-primary' : 'border-border hover:border-foreground/30'
              )}
            >
              <ThemeThumbnail id={id} canvas={canvas} />
              <span className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
                {selected && <Check className="size-4 text-primary" aria-hidden="true" />}
                {theme.label}
              </span>
              <span className="block text-xs text-muted-foreground">{theme.description}</span>
            </button>
          )
        })}
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-sm font-semibold">Glass background image</p>
        <p className="text-xs text-muted-foreground mb-3">
          Optional. Used by the Glass theme instead of the built-in gradient; the calendar is
          frosted over it. JPEG, PNG or WebP up to 25 MB; an image the size of your screen fits exactly.
          Stored on this computer only.
        </p>
        <div className="flex items-center gap-3">
          {background && (
            <img
              src={wallpaperBackgroundUrl(background.version)}
              alt="Current Glass background"
              className="h-12 w-[170px] object-cover rounded border border-border"
            />
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-label="Choose background image"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) uploadMutation.mutate(file)
              e.target.value = ''
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            <ImageUp className="size-4 mr-2" aria-hidden="true" />
            {uploadMutation.isPending ? 'Uploading…' : background ? 'Replace image' : 'Upload image'}
          </Button>
          {background && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => removeMutation.mutate()}>
              <Trash2 className="size-4 mr-2" aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
        {background && current !== 'glass' && (
          <p className="text-xs text-muted-foreground mt-2">The image is only used when the Glass theme is selected.</p>
        )}
      </div>
    </div>
  )
}

/** Tiny wallpaper mock-up drawn in the theme's own colors. */
function ThemeThumbnail({ id, canvas }: { id: WallpaperThemeId; canvas: string }): React.JSX.Element {
  const theme = WALLPAPER_THEMES[id]
  const panel = theme.panel
  return (
    <div aria-hidden="true" className="h-20 rounded-md overflow-hidden p-2" style={{ background: canvas }}>
      <div
        className="h-full grid grid-cols-7 gap-px rounded-sm p-1"
        style={panel ? { background: panel.background, border: `1px solid ${panel.border}`, backdropFilter: 'blur(4px)' } : undefined}
      >
        {Array.from({ length: 21 }, (_, i) => (
          <div
            key={i}
            className="rounded-[1px]"
            style={{
              border: `1px solid ${theme.vars['--border']}`,
              background: i === 9 ? theme.today.fill : undefined,
              boxShadow: i === 9 ? `inset 0 0 0 1px ${theme.today.ring}` : undefined,
            }}
          />
        ))}
      </div>
    </div>
  )
}
