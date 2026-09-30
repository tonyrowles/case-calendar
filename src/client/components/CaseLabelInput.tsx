import React, { useId, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'

import { Input } from '@/client/components/ui/input.js'
import { cn } from '@/client/lib/utils.js'
import { CaseSwatch } from '@/client/components/CaseBadge.js'
import { findExistingCase, suggestCases } from '@/shared/lib/case-labels.js'

export interface CaseLabelInputProps {
  id: string
  value: string
  labels: readonly string[]
  /** Optional case -> color, shown as a swatch next to each existing case */
  caseColorOf?: (caseLabel: string) => string
  /** Existing cases to leave out of the suggestions (archived); they still count for matching */
  isHidden?: (caseLabel: string) => boolean
  onChange: (value: string) => void
  onBlur?: () => void
  inputRef?: React.Ref<HTMLInputElement>
  placeholder?: string
  'aria-describedby'?: string
}

type Option = { kind: 'existing'; label: string } | { kind: 'new'; label: string }

/**
 * Case field for the deadline form: a text input with a suggestion list of existing
 * cases (ARIA combobox). Typing filters loosely ("smith v jon" finds "Smith v. Jones");
 * a typed name that matches no case offers "Add new case". On blur, a loose match
 * snaps to the existing label so the same case is never saved under two spellings.
 */
export function CaseLabelInput({
  id, value, labels, caseColorOf, isHidden, onChange, onBlur, inputRef, placeholder, ...aria
}: CaseLabelInputProps): React.JSX.Element {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const options: Option[] = useMemo(() => {
    const visible = isHidden ? labels.filter(l => !isHidden(l)) : labels
    const existing = suggestCases(value, visible).map(label => ({ kind: 'existing' as const, label }))
    const typed = value.trim()
    const isNew = typed !== '' && findExistingCase(typed, labels) === null
    return isNew ? [...existing, { kind: 'new' as const, label: typed }] : existing
  }, [value, labels, isHidden])

  const showList = open && options.length > 0

  function choose(opt: Option): void {
    onChange(opt.label)
    setOpen(false)
    setActive(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive(i => (options.length === 0 ? -1 : (i + 1) % options.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActive(i => (options.length === 0 ? -1 : (i <= 0 ? options.length - 1 : i - 1)))
    } else if (e.key === 'Enter' && showList && active >= 0 && active < options.length) {
      // Pick the highlighted suggestion instead of submitting the form
      e.preventDefault()
      choose(options[active])
    } else if (e.key === 'Escape' && showList) {
      e.preventDefault()
      setOpen(false)
      setActive(-1)
    }
  }

  function handleBlur(): void {
    setOpen(false)
    setActive(-1)
    const existing = findExistingCase(value, labels)
    if (existing !== null && existing !== value) onChange(existing)
    else if (value !== value.trim()) onChange(value.trim())
    onBlur?.()
  }

  return (
    <div className="relative">
      <Input
        id={id}
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-opt-${active}` : undefined}
        aria-describedby={aria['aria-describedby']}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1) }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Cases"
          className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md py-1"
        >
          {options.map((opt, i) => (
            <li
              key={`${opt.kind}:${opt.label}`}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown (not click) + preventDefault: select before the input blurs
              onMouseDown={e => { e.preventDefault(); choose(opt) }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer',
                i === active && 'bg-accent text-accent-foreground',
                opt.kind === 'new' && 'border-t text-muted-foreground'
              )}
            >
              {opt.kind === 'new'
                ? <><Plus className="size-4 shrink-0" aria-hidden="true" /><span>Add new case "<span className="text-foreground">{opt.label}</span>"</span></>
                : <>{caseColorOf && <CaseSwatch color={caseColorOf(opt.label)} />}<span>{opt.label}</span></>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
