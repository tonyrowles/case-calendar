// Loads .env.local into process.env. Must be the FIRST import in index.ts: ESM
// evaluates imports in order, and cors.ts (TAILSCALE_HOSTNAME) plus the
// WALLPAPER_ENABLED boot gate read process.env before any worker runs.
// Previously only email.ts called dotenv, after the wallpaper gate had already
// run, so WALLPAPER_ENABLED/TAILSCALE_HOSTNAME in .env.local were ignored unless
// NSSM injected them. dotenv never overrides vars already set in the environment.
import dotenv from 'dotenv'

if (process.env.VITEST !== 'true') {
  dotenv.config({ path: '.env.local', quiet: true })
}
