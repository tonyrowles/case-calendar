// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DeadlineForm } from './components/DeadlineForm.js'

// Mock the api module so DeadlineForm doesn't fire real fetch calls in tests
vi.mock('./lib/api.js', () => ({
  getDeadlineTypes: vi.fn().mockResolvedValue([]),
  createDeadline: vi.fn().mockResolvedValue({}),
}))

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('DeadlineForm', () => {
  it('all text inputs and textarea carry autocomplete="off"', async () => {
    renderWithQuery(<DeadlineForm />)
    // Case input
    const caseInput = screen.getByPlaceholderText('e.g. Smith v. Jones')
    expect(caseInput.getAttribute('autocomplete')).toBe('off')
    // Description textarea
    const descTextarea = screen.getByPlaceholderText('Hearing time, motion number, filing notes…')
    expect(descTextarea.getAttribute('autocomplete')).toBe('off')
  })

  it('form root carries autocomplete="off"', () => {
    const { container } = renderWithQuery(<DeadlineForm />)
    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    expect(form!.getAttribute('autocomplete')).toBe('off')
  })

  it('renders Save Deadline button', () => {
    renderWithQuery(<DeadlineForm />)
    expect(screen.getByRole('button', { name: /save deadline/i })).toBeDefined()
  })

  it('renders Add Deadline heading', () => {
    renderWithQuery(<DeadlineForm />)
    expect(screen.getByText('Add Deadline')).toBeDefined()
  })
})
