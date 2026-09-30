// Routes: /api/settings (wallpaper theme) and /api/wallpaper-background (Glass theme image)
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { app } from '../index.js'
import { sqlite } from '../db.js'
import { onMutation } from '../queries.js'
import { deleteBackground, MAX_BACKGROUND_BYTES } from '../lib/wallpaper-background.js'

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)])
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 2)])
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(32, 3)])

function putJson(body: unknown) {
  return app.request('/api/settings', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

function putImage(data: Buffer, contentType = 'application/octet-stream') {
  return app.request('/api/wallpaper-background', {
    method: 'PUT', headers: { 'Content-Type': contentType }, body: data,
  })
}

async function settings() {
  return (await app.request('/api/settings')).json()
}

describe('/api/settings', () => {
  beforeEach(() => {
    sqlite.exec('DELETE FROM app_settings')
    deleteBackground()
  })

  it('ST1: defaults to the light theme with no background image', async () => {
    expect(await settings()).toEqual({ wallpaperTheme: 'light', wallpaperBackground: null })
  })

  it('ST2: PUT saves the wallpaper theme', async () => {
    const res = await putJson({ wallpaperTheme: 'glass' })
    expect(res.status).toBe(200)
    expect((await res.json()).wallpaperTheme).toBe('glass')
    expect((await settings()).wallpaperTheme).toBe('glass')
  })

  it('ST3: PUT rejects unknown themes and unknown keys (422)', async () => {
    expect((await putJson({ wallpaperTheme: 'neon' })).status).toBe(422)
    expect((await putJson({ wallpaperTheme: 'dark', other: 1 })).status).toBe(422)
    expect((await settings()).wallpaperTheme).toBe('light')
  })

  it('ST4: an unrecognized stored value falls back to the default theme', async () => {
    sqlite.prepare("INSERT INTO app_settings (key, value) VALUES ('wallpaperTheme', 'bogus')").run()
    expect((await settings()).wallpaperTheme).toBe('light')
  })
})

describe('/api/wallpaper-background', () => {
  beforeEach(() => {
    deleteBackground()
  })

  it('WB1: GET is 404 when no image has been uploaded', async () => {
    expect((await app.request('/api/wallpaper-background')).status).toBe(404)
  })

  it('WB2: PUT stores a PNG; GET serves it back with its type; settings report a version', async () => {
    const res = await putImage(PNG, 'image/png')
    expect(res.status).toBe(200)
    const { version } = await res.json()
    expect(typeof version).toBe('number')

    const get = await app.request('/api/wallpaper-background')
    expect(get.status).toBe(200)
    expect(get.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await get.arrayBuffer()).equals(PNG)).toBe(true)
    expect((await settings()).wallpaperBackground).toEqual({ version })
  })

  it('WB3: type is detected from the bytes, not the header (JPEG and WebP accepted)', async () => {
    expect((await putImage(JPEG, 'image/png')).status).toBe(200)
    expect((await app.request('/api/wallpaper-background')).headers.get('content-type')).toBe('image/jpeg')
    expect((await putImage(WEBP)).status).toBe(200)
    expect((await app.request('/api/wallpaper-background')).headers.get('content-type')).toBe('image/webp')
  })

  it('WB4: a new upload replaces the previous image (one file, any type)', async () => {
    await putImage(PNG)
    await putImage(JPEG)
    const get = await app.request('/api/wallpaper-background')
    expect(Buffer.from(await get.arrayBuffer()).equals(JPEG)).toBe(true)
  })

  it('WB5: non-images are rejected (415) and oversized uploads (413)', async () => {
    expect((await putImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml')).status).toBe(415)
    const huge = Buffer.concat([PNG, Buffer.alloc(MAX_BACKGROUND_BYTES)])
    expect((await putImage(huge, 'image/png')).status).toBe(413)
    expect((await app.request('/api/wallpaper-background')).status).toBe(404)
  })

  it('WB6: DELETE removes the image (204), then 404', async () => {
    await putImage(PNG)
    expect((await app.request('/api/wallpaper-background', { method: 'DELETE' })).status).toBe(204)
    expect((await settings()).wallpaperBackground).toBeNull()
    expect((await app.request('/api/wallpaper-background', { method: 'DELETE' })).status).toBe(404)
  })

  it('WB7: theme changes, uploads and removals wake the wallpaper worker (HOOK-04)', async () => {
    const spy = vi.fn()
    onMutation(spy)
    await putJson({ wallpaperTheme: 'dark' })
    await putImage(PNG)
    await app.request('/api/wallpaper-background', { method: 'DELETE' })
    expect(spy).toHaveBeenCalledTimes(3)
    await putImage(Buffer.from('not an image'))
    expect(spy).toHaveBeenCalledTimes(3)
  })
})
