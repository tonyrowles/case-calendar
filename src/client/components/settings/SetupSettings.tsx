import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ConfigSaveError, getConfig, saveConfig, type AppConfig, type ConfigKey } from '@/client/lib/api.js'
import { Button } from '@/client/components/ui/button.js'
import { Input } from '@/client/components/ui/input.js'
import { Switch } from '@/client/components/ui/switch.js'
import { cn } from '@/client/lib/utils.js'

type Values = Partial<Record<ConfigKey, string>>

interface FieldSpec {
  key: ConfigKey
  label: string
  kind?: 'text' | 'secret' | 'email' | 'select'
  placeholder?: string
  help?: React.ReactNode
  options?: Array<{ value: string; label: string }>
  advanced?: boolean
}

function useSave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: Values) => saveConfig(values),
    onSuccess: data => queryClient.setQueryData(['config'], data),
  })
}

function SourceNote({ cfg, k }: { cfg: AppConfig; k: ConfigKey }) {
  return cfg.fields[k].source === 'env'
    ? <span className="text-xs text-muted-foreground"> (from .env.local)</span>
    : null
}

function StatusLine({ tone, children }: { tone: 'ok' | 'off' | 'error'; children: React.ReactNode }) {
  return (
    <p className={cn('text-xs', tone === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
      <span aria-hidden="true" className={cn('inline-block size-2 rounded-full mr-1.5 align-middle', tone === 'ok' ? 'bg-green-600' : tone === 'error' ? 'bg-destructive' : 'bg-muted-foreground/40')} />
      {children}
    </p>
  )
}

/**
 * A card of fields saved together with one button. Only changed fields are sent; secret
 * fields start empty (blank = keep the saved value) and can be removed explicitly.
 */
function SetupCard({ title, intro, cfg, fields, toggle, status }: {
  title: string
  intro?: React.ReactNode
  cfg: AppConfig
  fields: FieldSpec[]
  toggle?: { key: ConfigKey; label: string }
  status?: React.ReactNode
}) {
  const save = useSave()
  const [draft, setDraft] = useState<Values>({})
  const [errors, setErrors] = useState<Partial<Record<ConfigKey, string>>>({})
  const [message, setMessage] = useState<string | null>(null)
  const dirty = Object.keys(draft).length > 0
  const enabled = toggle ? cfg.fields[toggle.key].value === 'true' : true

  const submit = (values: Values) => {
    setMessage(null)
    save.mutate(values, {
      onSuccess: () => { setDraft({}); setErrors({}); setMessage('Saved.') },
      onError: err => {
        setErrors(err instanceof ConfigSaveError ? err.fields : {})
        setMessage(err.message)
      },
    })
  }

  const current = (f: FieldSpec) => draft[f.key] ?? (f.kind === 'secret' ? '' : cfg.fields[f.key].value ?? '')
  const set = (k: ConfigKey, v: string) => setDraft(d => ({ ...d, [k]: v }))

  const renderField = (f: FieldSpec) => {
    const id = `setup-${f.key}`
    const err = errors[f.key]
    const isSecretSet = f.kind === 'secret' && cfg.fields[f.key].set
    return (
      <div key={f.key} className="space-y-1">
        <label htmlFor={id} className="text-sm font-medium">{f.label}<SourceNote cfg={cfg} k={f.key} /></label>
        <div className="flex items-center gap-2">
          {f.kind === 'select' ? (
            <select
              id={id}
              className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              value={current(f)}
              onChange={e => set(f.key, e.target.value)}
            >
              {f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <Input
              id={id}
              type={f.kind === 'secret' ? 'password' : f.kind === 'email' ? 'email' : 'text'}
              autoComplete="off"
              spellCheck={false}
              value={current(f)}
              placeholder={isSecretSet ? 'Saved (type to replace)' : f.placeholder}
              onChange={e => set(f.key, e.target.value)}
              aria-invalid={err ? true : undefined}
            />
          )}
          {isSecretSet && draft[f.key] === undefined && (
            <Button type="button" variant="ghost" size="sm" onClick={() => submit({ [f.key]: '' })} disabled={save.isPending}>
              Remove
            </Button>
          )}
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
        {f.help && !err && <p className="text-xs text-muted-foreground">{f.help}</p>}
      </div>
    )
  }

  const basic = fields.filter(f => !f.advanced)
  const advanced = fields.filter(f => f.advanced)

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3" data-testid={`setup-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold">{title}</h4>
          {intro && <p className="text-sm text-muted-foreground mt-0.5">{intro}</p>}
        </div>
        {toggle && (
          <Switch
            aria-label={toggle.label}
            checked={enabled}
            disabled={save.isPending}
            onCheckedChange={on => submit({ [toggle.key]: on ? 'true' : 'false' })}
          />
        )}
      </div>
      {status}
      {basic.map(renderField)}
      {advanced.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Advanced</summary>
          <div className="space-y-3 mt-3">{advanced.map(renderField)}</div>
        </details>
      )}
      {fields.length > 0 && (
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" disabled={!dirty || save.isPending} onClick={() => submit(draft)}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
          {dirty && <Button type="button" variant="ghost" size="sm" onClick={() => { setDraft({}); setErrors({}) }}>Cancel</Button>}
          {message && <span role="status" className={cn('text-xs', Object.keys(errors).length || save.isError ? 'text-destructive' : 'text-muted-foreground')}>{message}</span>}
        </div>
      )}
    </div>
  )
}

function TimeZoneCard({ cfg }: { cfg: AppConfig }) {
  const save = useSave()
  const zones = useMemo(() => {
    try { return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone') }
    catch { return [] }
  }, [])
  const saved = cfg.fields.TZ.source === 'app' ? cfg.fields.TZ.value ?? '' : ''
  const effective = cfg.fields.TZ.value || cfg.defaultTimeZone
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const options = zones.includes(saved) || saved === '' ? zones : [saved, ...zones]
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <h4 className="font-semibold">Time zone</h4>
      <p className="text-sm text-muted-foreground">Decides what “today” is for the wallpaper, the list and the daily digest.</p>
      <select
        aria-label="Time zone"
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={saved}
        disabled={save.isPending}
        onChange={e => save.mutate({ TZ: e.target.value })}
      >
        <option value="">This computer’s time zone ({cfg.defaultTimeZone})</option>
        {options.map(z => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
      </select>
      {effective !== browserZone && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          This browser is set to {browserZone.replace(/_/g, ' ')}, so dates in this window may differ from the wallpaper.
        </p>
      )}
    </div>
  )
}

/** Settings > Setup: everything that used to need .env.local. Changes apply immediately. */
export function SetupSettings(): React.JSX.Element {
  const configQuery = useQuery({ queryKey: ['config'], queryFn: getConfig })
  const cfg = configQuery.data

  if (configQuery.isError) return <p className="text-sm text-destructive">Couldn't load setup. Refresh the page.</p>
  if (!cfg) return <div className="h-24 animate-pulse rounded-lg bg-muted" />

  const { status } = cfg
  const account = cfg.fields.SMTP_USER.value || ''
  const lastCheck = status.emailImport.lastCheck

  return (
    <div className="space-y-3">
      <TimeZoneCard cfg={cfg} />

      <SetupCard
        title="AI provider"
        intro="Reads deadlines from typed text (Ctrl+K), pasted orders and emailed orders. Keys are kept on this computer."
        cfg={cfg}
        status={status.ai.configured
          ? <StatusLine tone="ok">Using {status.ai.provider === 'openai' ? 'OpenAI' : 'Anthropic'}.</StatusLine>
          : <StatusLine tone="off">Not set up: add an API key to turn on AI features.</StatusLine>}
        fields={[
          { key: 'OPENAI_API_KEY', label: 'OpenAI API key', kind: 'secret', placeholder: 'sk-…', help: <>Create one at platform.openai.com → API keys (separate from a ChatGPT subscription).</> },
          { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API key', kind: 'secret', placeholder: 'sk-ant-…', help: 'Optional alternative: console.anthropic.com → API keys.' },
          { key: 'LLM_PROVIDER', label: 'Provider', kind: 'select', advanced: true, options: [
            { value: '', label: 'Automatic (OpenAI when its key is set)' },
            { value: 'openai', label: 'OpenAI' },
            { value: 'anthropic', label: 'Anthropic' },
          ] },
          { key: 'OPENAI_MODEL', label: 'OpenAI model', advanced: true, placeholder: 'gpt-5.6' },
        ]}
      />

      <SetupCard
        title="Email account"
        intro="Used to send the daily digest and to read emailed orders (read-only). Gmail needs an app password."
        cfg={cfg}
        status={account ? <StatusLine tone="ok">Account: {account}</StatusLine> : <StatusLine tone="off">No account set.</StatusLine>}
        fields={[
          { key: 'SMTP_USER', label: 'Email address', kind: 'email', placeholder: 'you@gmail.com' },
          { key: 'SMTP_PASS', label: 'App password', kind: 'secret', placeholder: 'xxxx xxxx xxxx xxxx', help: 'Google Account → Security → 2-Step Verification → App passwords. Not your normal password.' },
          { key: 'SMTP_HOST', label: 'Outgoing server (SMTP)', advanced: true, placeholder: 'smtp.gmail.com' },
          { key: 'SMTP_PORT', label: 'Outgoing port', advanced: true, placeholder: '587' },
          { key: 'IMAP_HOST', label: 'Incoming server (IMAP)', advanced: true, placeholder: 'imap.gmail.com' },
          { key: 'IMAP_PORT', label: 'Incoming port', advanced: true, placeholder: '993' },
        ]}
      />

      <SetupCard
        title="Daily digest"
        intro="An email at 7:00 AM listing upcoming deadlines."
        cfg={cfg}
        toggle={{ key: 'EMAIL_DIGEST_ENABLED', label: 'Send the daily digest' }}
        status={status.digest.state === 'on'
          ? <StatusLine tone="ok">Scheduled for 7:00 AM every day.</StatusLine>
          : status.digest.state === 'error'
            ? <StatusLine tone="error">{status.digest.message}</StatusLine>
            : <StatusLine tone="off">Off.</StatusLine>}
        fields={[
          { key: 'SMTP_TO', label: 'Send to', kind: 'email', placeholder: account || 'you@gmail.com', help: 'Defaults to the account address.' },
        ]}
      />

      <SetupCard
        title="Email import"
        intro="Email an order to your import address and its deadlines wait in the Inbox for review."
        cfg={cfg}
        toggle={{ key: 'EMAIL_IMPORT_ENABLED', label: 'Check for emailed orders' }}
        status={!status.emailImport.enabled
          ? <StatusLine tone="off">{cfg.fields.EMAIL_IMPORT_ENABLED.value === 'true' ? 'Needs an email account and an import address.' : 'Off.'}</StatusLine>
          : lastCheck && !lastCheck.ok
            ? <StatusLine tone="error">{lastCheck.error}</StatusLine>
            : <StatusLine tone="ok">Checking every 5 minutes{lastCheck ? `; last checked ${new Date(lastCheck.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}.</StatusLine>}
        fields={[
          { key: 'EMAIL_IMPORT_ADDRESS', label: 'Import address', kind: 'email', placeholder: account ? account.replace('@', '+calendar@') : 'you+calendar@gmail.com', help: 'A plus-address of the account works: mail to it lands in the same inbox.' },
          { key: 'EMAIL_IMPORT_ALLOWED_SENDERS', label: 'Accept orders from', placeholder: account || 'you@gmail.com, you@firm.com', help: 'Comma-separated. Defaults to the account address. Mail from anyone else is ignored.' },
        ]}
      />

      <SetupCard
        title="Desktop wallpaper"
        intro="Draws your deadlines as the Windows desktop background, updated every 30 minutes and after each change."
        cfg={cfg}
        toggle={{ key: 'WALLPAPER_ENABLED', label: 'Show deadlines on the desktop wallpaper' }}
        status={status.wallpaper.running ? <StatusLine tone="ok">On.</StatusLine> : <StatusLine tone="off">Off.</StatusLine>}
        fields={[]}
      />
    </div>
  )
}
