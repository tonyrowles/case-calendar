// Desktop wallpaper themes. The wallpaper route renders with the app's Tailwind
// classes (text-foreground, text-muted-foreground, border-border), which read the
// CSS variables below; a theme overrides them on the wallpaper root, plus the canvas
// background, an optional frosted panel, and the "today" highlight.

export const WALLPAPER_THEME_IDS = ['light', 'dark', 'glass'] as const
export type WallpaperThemeId = (typeof WALLPAPER_THEME_IDS)[number]
export const DEFAULT_WALLPAPER_THEME: WallpaperThemeId = 'light'

export interface WallpaperTheme {
  id: WallpaperThemeId
  label: string
  description: string
  /** CSS `background` for the full 7680x2160 canvas */
  canvas: string
  /** Overrides for the app's color variables, applied on the wallpaper root */
  vars: { '--foreground': string; '--muted-foreground': string; '--border': string }
  /** Frosted panel behind all content (glass theme); none = content sits on the canvas */
  panel?: { background: string; border: string; blurPx: number; radiusPx: number; paddingPx: number }
  today: { fill: string; ring: string; text: string }
  /** Opacity of days before today */
  pastOpacity: number
  /** CSS filter for case badges: tones down fully saturated fills on dark canvases */
  caseColorFilter?: string
  /**
   * Dark themes: approximate background color behind the content. Case colors too close
   * to it are lightened (liftForDarkBackground) so every case stays visible.
   */
  darkBackground?: string
}

export const WALLPAPER_THEMES: Record<WallpaperThemeId, WallpaperTheme> = {
  light: {
    id: 'light',
    label: 'Light',
    description: 'White background, dark text.',
    canvas: '#FFFFFF',
    vars: { '--foreground': '#111827', '--muted-foreground': '#6B7280', '--border': '#CBD1DA' },
    today: { fill: '#FFFBEB', ring: '#B45309', text: '#B45309' },
    pastOpacity: 0.4,
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    description: 'Deep slate background, soft light text, subtle grid lines.',
    canvas: '#0B1220',
    vars: { '--foreground': '#D6DCE5', '--muted-foreground': '#7D889B', '--border': 'rgba(148, 163, 184, 0.30)' },
    today: { fill: 'rgba(245, 158, 11, 0.10)', ring: 'rgba(245, 158, 11, 0.75)', text: '#F2B84B' },
    pastOpacity: 0.35,
    caseColorFilter: 'saturate(0.85)',
    darkBackground: '#0B1220',
  },
  glass: {
    id: 'glass',
    label: 'Glass',
    description: 'Frosted translucent panel over a dark gradient or your own image.',
    canvas: [
      'radial-gradient(ellipse at 18% 25%, rgba(56, 97, 150, 0.55) 0%, transparent 55%)',
      'radial-gradient(ellipse at 82% 78%, rgba(98, 60, 130, 0.45) 0%, transparent 55%)',
      'radial-gradient(ellipse at 55% 110%, rgba(20, 110, 120, 0.35) 0%, transparent 50%)',
      'linear-gradient(135deg, #0A1020 0%, #111827 55%, #140F24 100%)',
    ].join(', '),
    vars: { '--foreground': '#EEF2F7', '--muted-foreground': 'rgba(226, 232, 240, 0.62)', '--border': 'rgba(255, 255, 255, 0.18)' },
    panel: { background: 'rgba(15, 23, 42, 0.42)', border: 'rgba(255, 255, 255, 0.10)', blurPx: 28, radiusPx: 36, paddingPx: 56 },
    today: { fill: 'rgba(251, 191, 36, 0.10)', ring: 'rgba(251, 191, 36, 0.65)', text: '#F8CC5A' },
    pastOpacity: 0.35,
    caseColorFilter: 'saturate(0.9)',
    darkBackground: '#141C2E',
  },
}

/**
 * Glass canvas over a user-supplied image (cover-fit), with a light dark wash so the
 * frosted panel and text keep their contrast on bright photos.
 */
export function glassCanvasWithImage(imageUrl: string): string {
  return `linear-gradient(rgba(8, 12, 24, 0.30), rgba(8, 12, 24, 0.30)), url("${imageUrl}") center / cover no-repeat, #0A1020`
}

export function isWallpaperThemeId(v: unknown): v is WallpaperThemeId {
  return typeof v === 'string' && (WALLPAPER_THEME_IDS as readonly string[]).includes(v)
}
