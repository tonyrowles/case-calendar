// Route: /api/case-colors — user-chosen case colors (overrides of the automatic color)
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { app } from '../index.js'
import { sqlite } from '../db.js'
import { onMutation } from '../queries.js'
import { CASE_PALETTE } from '../../shared/lib/case-colors.js'

const RED = CASE_PALETTE[0]
const GREEN = CASE_PALETTE[1]

function put(body: unknown) {
  return app.request('/api/case-colors', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function del(caseLabel?: string) {
  const qs = caseLabel === undefined ? '' : `?caseLabel=${encodeURIComponent(caseLabel)}`
  return app.request(`/api/case-colors${qs}`, { method: 'DELETE' })
}

async function list(): Promise<Array<{ caseLabel: string; color: string }>> {
  return (await app.request('/api/case-colors')).json()
}

describe('/api/case-colors', () => {
  beforeEach(() => {
    sqlite.exec('DELETE FROM case_colors')
  })

  it('CC1: GET returns [] when no case has a custom color', async () => {
    const res = await app.request('/api/case-colors')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('CC2: PUT pins a case to a palette color; GET returns it', async () => {
    const res = await put({ caseLabel: 'Glaukos/Spyglass', color: RED })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ caseLabel: 'Glaukos/Spyglass', color: RED })
    expect(await list()).toEqual([{ caseLabel: 'Glaukos/Spyglass', color: RED }])
  })

  it('CC3: PUT again replaces the color (one row per case, keyed case/space-insensitively)', async () => {
    await put({ caseLabel: 'Smith v. Jones', color: RED })
    await put({ caseLabel: '  smith v.  JONES ', color: GREEN })
    const rows = await list()
    expect(rows).toHaveLength(1)
    expect(rows[0].color).toBe(GREEN)
  })

  it('CC4: PUT rejects colors outside the palette, empty labels, and unknown fields (422)', async () => {
    expect((await put({ caseLabel: 'Smith v. Jones', color: '#123456' })).status).toBe(422)
    expect((await put({ caseLabel: '   ', color: RED })).status).toBe(422)
    expect((await put({ caseLabel: 'Smith v. Jones', color: RED, extra: 1 })).status).toBe(422)
    expect(await list()).toEqual([])
  })

  it('CC5: DELETE ?caseLabel= resets to automatic (204), then 404 when nothing is left', async () => {
    await put({ caseLabel: 'Glaukos/Spyglass', color: RED })
    expect((await del('glaukos/spyglass')).status).toBe(204)
    expect(await list()).toEqual([])
    expect((await del('Glaukos/Spyglass')).status).toBe(404)
  })

  it('CC6: DELETE without caseLabel is a 422', async () => {
    expect((await del()).status).toBe(422)
  })

  it('CC7: changes notify the wallpaper worker (HOOK-04); a no-op delete does not', async () => {
    const spy = vi.fn()
    onMutation(spy)
    await put({ caseLabel: 'Smith v. Jones', color: RED })
    expect(spy).toHaveBeenCalledTimes(1)
    await del('Smith v. Jones')
    expect(spy).toHaveBeenCalledTimes(2)
    await del('Smith v. Jones')
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
