import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import fs from 'node:fs'
import { __resetFetch, __setFetch, __setReleaseInfo, checkForUpdate, downloadUpdate, isNewer, type FetchFn } from './updates.js'

const ASSET_URL = 'https://api.github.com/repos/me/case-calendar/releases/assets/123'
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2048, 7)])

function release(tag: string) {
  return { tag_name: tag, assets: [{ name: `CaseCalendarSetup-${tag.slice(1)}.exe`, url: ASSET_URL, size: EXE.length }] }
}

let calls: Array<{ url: string; headers: Record<string, string> }>
function fakeFetch(handler: (url: string) => Response): FetchFn {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string> })
    return handler(String(input))
  }) as FetchFn
}

describe('updates', () => {
  const savedToken = process.env.UPDATE_GITHUB_TOKEN
  beforeEach(() => {
    calls = []
    delete process.env.UPDATE_GITHUB_TOKEN
    __setReleaseInfo({ version: '0.2.0', repo: 'me/case-calendar' })
  })
  afterEach(() => {
    __resetFetch()
    __setReleaseInfo(undefined)
    if (savedToken === undefined) delete process.env.UPDATE_GITHUB_TOKEN
    else process.env.UPDATE_GITHUB_TOKEN = savedToken
  })

  it('compares versions numerically', () => {
    expect(isNewer('0.10.0', '0.9.3')).toBe(true)
    expect(isNewer('v1.0.0', '1.0.0')).toBe(false)
    expect(isNewer('0.2.0', '0.3.0')).toBe(false)
    expect(isNewer('garbage', '0.1.0')).toBe(false)
  })

  it('a developer checkout (no release.json) does not check GitHub', async () => {
    __setReleaseInfo(null)
    __setFetch(fakeFetch(() => { throw new Error('should not be called') }))
    expect(await checkForUpdate()).toMatchObject({ installed: false, available: false, error: null })
    expect(calls).toHaveLength(0)
  })

  it('reports a newer release, sending the token when one is saved', async () => {
    process.env.UPDATE_GITHUB_TOKEN = 'github_pat_abc'
    __setFetch(fakeFetch(() => Response.json(release('v0.3.0'))))
    expect(await checkForUpdate()).toEqual({ installed: true, current: '0.2.0', latest: '0.3.0', available: true, usingToken: true, error: null })
    expect(calls[0].url).toBe('https://api.github.com/repos/me/case-calendar/releases/latest')
    expect(calls[0].headers.Authorization).toBe('Bearer github_pat_abc')
  })

  it('no token: no Authorization header; same version is up to date', async () => {
    __setFetch(fakeFetch(() => Response.json(release('v0.2.0'))))
    expect(await checkForUpdate()).toMatchObject({ available: false, latest: '0.2.0', error: null })
    expect(calls[0].headers.Authorization).toBeUndefined()
  })

  it('a private repo without a token explains what to do', async () => {
    __setFetch(fakeFetch(() => new Response('{}', { status: 404 })))
    expect((await checkForUpdate()).error).toMatch(/private.*token/i)
  })

  it('a rejected token says so', async () => {
    process.env.UPDATE_GITHUB_TOKEN = 'bad'
    __setFetch(fakeFetch(() => new Response('{}', { status: 401 })))
    expect((await checkForUpdate()).error).toMatch(/token is invalid/)
  })

  it('offline is reported, not thrown', async () => {
    __setFetch((async () => { throw new TypeError('fetch failed') }) as FetchFn)
    expect((await checkForUpdate()).error).toMatch(/offline/)
  })

  it('downloads the installer through the API asset URL and checks it is a Windows program', async () => {
    process.env.UPDATE_GITHUB_TOKEN = 'github_pat_abc'
    __setFetch(fakeFetch(url => url === ASSET_URL ? new Response(EXE) : Response.json(release('v0.3.0'))))
    const { path, version } = await downloadUpdate()
    expect(version).toBe('0.3.0')
    expect(path).toMatch(/CaseCalendarSetup-0\.3\.0\.exe$/)
    expect(fs.readFileSync(path).equals(EXE)).toBe(true)
    const dl = calls.find(c => c.url === ASSET_URL)!
    expect(dl.headers.Accept).toBe('application/octet-stream')
    expect(dl.headers.Authorization).toBe('Bearer github_pat_abc')
    fs.rmSync(path, { force: true })
  })

  it('rejects a download that is not an installer', async () => {
    __setFetch(fakeFetch(url => url === ASSET_URL ? new Response(Buffer.alloc(EXE.length, 1)) : Response.json(release('v0.3.0'))))
    await expect(downloadUpdate()).rejects.toThrow(/not a Windows program|incomplete/)
  })

  it('refuses to download when nothing newer exists', async () => {
    __setFetch(fakeFetch(() => Response.json(release('v0.2.0'))))
    await expect(downloadUpdate()).rejects.toThrow(/No update/)
  })
})
