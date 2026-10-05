/**
 * Updates for an installed copy (CaseCalendarSetup.exe): compare this build's version
 * (release.json, written by scripts/package-release.ps1) with the newest GitHub Release,
 * and download the new installer for the tray to run.
 *
 * The server does this (not the tray) so it can use the optional GitHub token saved in
 * Settings > Setup (UPDATE_GITHUB_TOKEN): needed while the repository is private, when
 * anonymous requests to the releases API get 404. With a token, the installer is fetched
 * through the API asset URL (Accept: application/octet-stream), which works for private repos.
 * A developer checkout has no release.json: it updates through git instead.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { logger } from '../logger.js'

export interface ReleaseInfo { version: string; repo: string }

export interface UpdateStatus {
  installed: boolean          // false: developer checkout (git updates)
  current: string | null
  latest: string | null
  available: boolean
  usingToken: boolean
  error: string | null
}

export type FetchFn = typeof fetch
let fetchImpl: FetchFn = (...args) => fetch(...args)
export function __setFetch(fn: FetchFn): void { fetchImpl = fn }
export function __resetFetch(): void { fetchImpl = (...args) => fetch(...args) }

let releaseInfoOverride: ReleaseInfo | null | undefined
export function __setReleaseInfo(info: ReleaseInfo | null | undefined): void { releaseInfoOverride = info }

/** This build's release.json (in the app folder, the server's working directory), or null. */
export function releaseInfo(): ReleaseInfo | null {
  if (releaseInfoOverride !== undefined) return releaseInfoOverride
  try {
    const raw = JSON.parse(fs.readFileSync(path.resolve('release.json'), 'utf8')) as Partial<ReleaseInfo>
    return raw.version && raw.repo ? { version: raw.version, repo: raw.repo } : null
  } catch {
    return null
  }
}

/** "v1.2.3" / "1.2.3-beta" -> [1, 2, 3]; null when not a version. */
export function parseVersion(s: string): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(s.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

function headers(accept: string): Record<string, string> {
  const h: Record<string, string> = { 'User-Agent': 'CaseCalendar', Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' }
  const token = process.env.UPDATE_GITHUB_TOKEN?.trim()
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

interface GhRelease { tag_name: string; assets: Array<{ name: string; url: string; size: number }> }

let latestAsset: { version: string; url: string; size: number } | null = null

/** Ask GitHub for the newest release. Never throws: problems come back in `error`. */
export async function checkForUpdate(): Promise<UpdateStatus> {
  const info = releaseInfo()
  const usingToken = !!process.env.UPDATE_GITHUB_TOKEN?.trim()
  const base: UpdateStatus = { installed: !!info, current: info?.version ?? null, latest: null, available: false, usingToken, error: null }
  if (!info) return base
  let res: Response
  try {
    res = await fetchImpl(`https://api.github.com/repos/${info.repo}/releases/latest`, {
      headers: headers('application/vnd.github+json'),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    logger.warn({ err }, 'updates: check failed')
    return { ...base, error: 'Could not reach GitHub (offline?).' }
  }
  if (res.status === 404) {
    return {
      ...base,
      error: usingToken
        ? 'No release found. Check that the token can read this repository.'
        : 'No release found. If the repository is private, add a GitHub token below.',
    }
  }
  if (res.status === 401 || res.status === 403) {
    return { ...base, error: 'GitHub refused the request: the token is invalid or lacks read access to this repository.' }
  }
  if (!res.ok) return { ...base, error: `GitHub answered ${res.status}.` }
  const rel = (await res.json()) as GhRelease
  const asset = rel.assets?.find(a => /^CaseCalendarSetup-.*\.exe$/i.test(a.name))
  const latest = rel.tag_name.replace(/^v/, '')
  const available = !!asset && isNewer(latest, info.version)
  latestAsset = available && asset ? { version: latest, url: asset.url, size: asset.size } : null
  return { ...base, latest, available }
}

/**
 * Download the newer installer (checking GitHub again first) to the temp folder and return its
 * path. The tray then runs it silently. Throws with a readable message on failure.
 */
export async function downloadUpdate(): Promise<{ path: string; version: string }> {
  // Always check again: never act on a stale result
  const status = await checkForUpdate()
  if (!status.available || !latestAsset) throw new Error(status.error ?? 'No update is available.')
  const { version, url, size } = latestAsset
  if (!/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/releases\/assets\/\d+$/.test(url)) {
    throw new Error('Unexpected download address.')
  }
  // Redirects to a signed storage URL; fetch drops the Authorization header on that
  // cross-origin hop, which the signed URL does not need
  const res = await fetchImpl(url, { headers: headers('application/octet-stream'), signal: AbortSignal.timeout(600_000) })
  if (!res.ok || !res.body) throw new Error(`Download failed (GitHub answered ${res.status}).`)
  const file = path.join(os.tmpdir(), `CaseCalendarSetup-${version.replace(/[^0-9A-Za-z.-]/g, '')}.exe`)
  await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), fs.createWriteStream(file))
  const stat = fs.statSync(file)
  const head = Buffer.alloc(2)
  const fd = fs.openSync(file, 'r')
  fs.readSync(fd, head, 0, 2, 0)
  fs.closeSync(fd)
  if ((size && stat.size !== size) || head.toString('ascii') !== 'MZ') {
    fs.rmSync(file, { force: true })
    throw new Error('The downloaded installer is incomplete or not a Windows program.')
  }
  logger.info({ version, bytes: stat.size }, 'updates: installer downloaded')
  return { path: file, version }
}
