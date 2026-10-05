// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AppConfig, ConfigKey, ConfigField } from '@/client/lib/api.js'

vi.mock('@/client/lib/api.js', () => ({
  getConfig: vi.fn(),
  getUpdateStatus: vi.fn().mockResolvedValue({ installed: false, current: null, latest: null, available: false, usingToken: false, error: null }),
  saveConfig: vi.fn(),
  ConfigSaveError: class ConfigSaveError extends Error {
    constructor(message: string, readonly fields: Record<string, string>) { super(message) }
  },
}))
import { getConfig, getUpdateStatus, saveConfig, ConfigSaveError } from '@/client/lib/api.js'
import { SetupSettings } from './SetupSettings.js'

const KEYS: ConfigKey[] = ['TZ', 'LLM_PROVIDER', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'ANTHROPIC_API_KEY', 'SMTP_USER', 'SMTP_PASS', 'SMTP_HOST', 'SMTP_PORT', 'IMAP_HOST', 'IMAP_PORT', 'EMAIL_DIGEST_ENABLED', 'SMTP_TO', 'SMTP_FROM', 'EMAIL_IMPORT_ENABLED', 'EMAIL_IMPORT_ADDRESS', 'EMAIL_IMPORT_ALLOWED_SENDERS', 'WALLPAPER_ENABLED', 'UPDATE_GITHUB_TOKEN']

function config(over: Partial<Record<ConfigKey, Partial<ConfigField>>> = {}): AppConfig {
  const fields = Object.fromEntries(KEYS.map(k => [k, { value: '', set: false, source: 'unset', ...over[k] }])) as AppConfig['fields']
  return {
    fields,
    defaultTimeZone: 'America/Los_Angeles',
    status: { ai: { provider: 'openai', configured: false }, digest: { state: 'off', message: null }, emailImport: { enabled: false, lastCheck: null }, wallpaper: { running: false } },
  }
}

function renderSetup(cfg: AppConfig) {
  vi.mocked(getConfig).mockResolvedValue(cfg)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><SetupSettings /></QueryClientProvider>)
}

describe('SetupSettings', () => {
  beforeEach(() => { vi.mocked(saveConfig).mockReset() })
  afterEach(() => cleanup())

  it('never shows a saved secret; offers Remove instead', async () => {
    renderSetup(config({ OPENAI_API_KEY: { value: null, set: true, source: 'app' } }))
    const input = await screen.findByLabelText('OpenAI API key') as HTMLInputElement
    expect(input.value).toBe('')
    expect(input.placeholder).toMatch(/Saved/)
    expect(input.type).toBe('password')
    const card = screen.getByTestId('setup-card-ai-provider')
    fireEvent.click(within(card).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(saveConfig).toHaveBeenCalledWith({ OPENAI_API_KEY: '' }))
  })

  it('saves only the changed fields of a card', async () => {
    vi.mocked(saveConfig).mockResolvedValue(config())
    renderSetup(config({ SMTP_HOST: { value: 'smtp.gmail.com', set: true, source: 'env' } }))
    fireEvent.change(await screen.findByLabelText('Email address'), { target: { value: 'me@gmail.com' } })
    fireEvent.change(screen.getByLabelText('App password'), { target: { value: 'abcd efgh ijkl mnop' } })
    const card = screen.getByTestId('setup-card-email-account')
    // Values that came from .env.local are labelled
    expect(within(card).getAllByText(/from \.env\.local/).length).toBeGreaterThan(0)
    fireEvent.click(within(card).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveConfig).toHaveBeenCalledWith({ SMTP_USER: 'me@gmail.com', SMTP_PASS: 'abcd efgh ijkl mnop' }))
    expect(await within(card).findByText('Saved.')).toBeTruthy()
  })

  it('shows per-field errors from the server', async () => {
    vi.mocked(saveConfig).mockRejectedValue(new ConfigSaveError('Some values are not valid.', { EMAIL_IMPORT_ADDRESS: 'Not a valid email address.' }))
    renderSetup(config())
    // Import is off, so its card starts collapsed
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Email import' }))
    fireEvent.change(screen.getByLabelText('Import address'), { target: { value: 'nope' } })
    const card = screen.getByTestId('setup-card-email-import')
    fireEvent.click(within(card).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(within(card).getByText('Not a valid email address.')).toBeTruthy())
  })

  it('switches save immediately', async () => {
    vi.mocked(saveConfig).mockResolvedValue(config())
    renderSetup(config())
    fireEvent.click(await screen.findByRole('switch', { name: 'Show deadlines on the desktop wallpaper' }))
    await waitFor(() => expect(saveConfig).toHaveBeenCalledWith({ WALLPAPER_ENABLED: 'true' }))
  })

  it('a card that is set up collapses to its status line, with Edit to open it', async () => {
    const cfg = config({ OPENAI_API_KEY: { value: null, set: true, source: 'app' } })
    cfg.status.ai = { provider: 'openai', configured: true }
    renderSetup(cfg)
    const card = await screen.findByTestId('setup-card-ai-provider')
    expect(within(card).getByText('Using OpenAI.')).toBeTruthy()
    expect(within(card).queryByLabelText('OpenAI API key')).toBeNull()
    fireEvent.click(within(card).getByRole('button', { name: 'Edit AI provider' }))
    expect(within(card).getByLabelText('OpenAI API key')).toBeTruthy()
    fireEvent.click(within(card).getByRole('button', { name: 'Done editing AI provider' }))
    expect(within(card).queryByLabelText('OpenAI API key')).toBeNull()
  })

  it('a card that is not set up stays open', async () => {
    renderSetup(config())
    expect(await screen.findByLabelText('Email address')).toBeTruthy()
    expect(within(screen.getByTestId('setup-card-email-account')).queryByRole('button', { name: /Edit/ })).toBeNull()
  })

  it('the Anthropic key sits under Advanced unless one is saved', async () => {
    renderSetup(config())
    const card = await screen.findByTestId('setup-card-ai-provider')
    const field = within(card).getByLabelText('Anthropic API key')
    expect(field.closest('details')).not.toBeNull()
    cleanup()
    renderSetup(config({ ANTHROPIC_API_KEY: { value: null, set: true, source: 'app' } }))
    const card2 = await screen.findByTestId('setup-card-ai-provider')
    expect(within(card2).getByLabelText('Anthropic API key').closest('details')).toBeNull()
  })

  it('the GitHub token shows only when the update check needs it', async () => {
    vi.mocked(getUpdateStatus).mockResolvedValueOnce({ installed: true, current: '0.2.1', latest: '0.2.1', available: false, usingToken: false, error: null })
    renderSetup(config())
    const card = await screen.findByTestId('setup-card-updates')
    expect(await within(card).findByText('Version 0.2.1 is up to date.')).toBeTruthy()
    // Up to date: collapsed, token not shown
    expect(within(card).queryByLabelText(/GitHub token/)).toBeNull()
    cleanup()
    vi.mocked(getUpdateStatus).mockResolvedValueOnce({ installed: true, current: '0.2.1', latest: null, available: false, usingToken: false, error: 'No release found. If the repository is private, add a GitHub token below.' })
    renderSetup(config())
    const card2 = await screen.findByTestId('setup-card-updates')
    await within(card2).findByText(/add a GitHub token below/)
    const token = within(card2).getByLabelText(/GitHub token/)
    expect(token.closest('details')).toBeNull()
  })
})
