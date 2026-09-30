// @vitest-environment jsdom
import React, { useState } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { CaseLabelInput } from './CaseLabelInput.js'

afterEach(() => cleanup())

function Harness({ isHidden }: { isHidden?: (l: string) => boolean }) {
  const [value, setValue] = useState('')
  return (
    <>
      <CaseLabelInput id="c" value={value} onChange={setValue} isHidden={isHidden}
        labels={['Smith v. Jones', 'Old Smith Matter', 'Doe v. Roe']} />
      <output data-testid="value">{value}</output>
    </>
  )
}

describe('CaseLabelInput', () => {
  it('suggests matching existing cases and offers "Add new case" for a new name', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'smith' } })
    const options = screen.getAllByRole('option').map(o => o.textContent)
    expect(options).toContain('Smith v. Jones')
    expect(options).toContain('Old Smith Matter')
    expect(options.some(o => o?.startsWith('Add new case'))).toBe(true)
  })

  it('archived (hidden) cases are left out of suggestions but a typed match still snaps to them', () => {
    render(<Harness isHidden={l => l === 'Old Smith Matter'} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'smith' } })
    const options = screen.getAllByRole('option').map(o => o.textContent)
    expect(options).toContain('Smith v. Jones')
    expect(options).not.toContain('Old Smith Matter')

    fireEvent.change(input, { target: { value: 'old smith matter' } })
    // An exact (loose) match to an archived case: no "Add new case" offer, no duplicate case
    expect(screen.queryAllByRole('option').some(o => o.textContent?.startsWith('Add new case'))).toBe(false)
    fireEvent.blur(input)
    expect(screen.getByTestId('value').textContent).toBe('Old Smith Matter')
  })
})
