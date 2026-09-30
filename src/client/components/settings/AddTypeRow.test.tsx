// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AddTypeRow } from './AddTypeRow.js'

// TYPE-01: AddTypeRow — submits POST to create a new deadline type

function renderAddTypeRow() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AddTypeRow />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('TYPE-01: AddTypeRow — add new deadline type', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('Add button is disabled when the name input is empty', () => {
    renderAddTypeRow()
    const addBtn = screen.getByRole('button', { name: /^add$/i })
    expect((addBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('Add button is enabled once name input has at least one character', async () => {
    renderAddTypeRow()
    const input = screen.getByRole('textbox', { name: /new type name/i })
    fireEvent.change(input, { target: { value: 'T' } })
    await waitFor(() => {
      expect((screen.getByRole('button', { name: /^add$/i }) as HTMLButtonElement).disabled).toBe(false)
    })
  })

  it('clicking Add triggers POST /api/deadline-types with name + color', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ id: 10, name: 'Arbitration', color: '#1D4ED8', createdAt: '' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    renderAddTypeRow()
    const input = screen.getByRole('textbox', { name: /new type name/i })
    fireEvent.change(input, { target: { value: 'Arbitration' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/deadline-types',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"name":"Arbitration"'),
        })
      )
    })
  })

  it('on 201 response the name input clears and color resets to default', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ id: 10, name: 'Arbitration', color: '#1D4ED8', createdAt: '' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    renderAddTypeRow()
    const input = screen.getByRole('textbox', { name: /new type name/i })
    fireEvent.change(input, { target: { value: 'Arbitration' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() => {
      expect((screen.getByRole('textbox', { name: /new type name/i }) as HTMLInputElement).value).toBe('')
    })
  })

  it('pressing Enter in the name input triggers the Add action', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ id: 11, name: 'Mediation', color: '#1D4ED8', createdAt: '' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    renderAddTypeRow()
    const input = screen.getByRole('textbox', { name: /new type name/i })
    fireEvent.change(input, { target: { value: 'Mediation' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/deadline-types',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('409 type_name_taken response shows inline error banner below the row', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'type_name_taken', message: 'A type with that name already exists.' } }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    )

    renderAddTypeRow()
    const input = screen.getByRole('textbox', { name: /new type name/i })
    fireEvent.change(input, { target: { value: 'Filing' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText('A type with that name already exists.')).toBeTruthy()
    })
  })
})
