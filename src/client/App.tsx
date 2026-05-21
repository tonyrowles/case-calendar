import { useState } from 'react'
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient.js'
import { getDeadlines, createDeadline } from './lib/api.js'
import type { DeadlineCreate } from './lib/api.js'

function DeadlineForm() {
  const qc = useQueryClient()
  const [date, setDate] = useState('')
  const [caseLabel, setCaseLabel] = useState('')
  const [typeId, setTypeId] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (data: DeadlineCreate) => createDeadline(data),
    onSuccess: () => {
      setError(null)
      setDate('')
      setCaseLabel('')
      setTypeId('')
      setDescription('')
      qc.invalidateQueries({ queryKey: ['deadlines'] })
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const id = parseInt(typeId, 10)
    if (!date || !caseLabel || !id) {
      setError('Date, case label, and type are required.')
      return
    }
    mutation.mutate({ date, caseLabel, typeId: id, description: description || undefined })
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
      <h2>Add Deadline</h2>
      {error && (
        <p style={{ color: 'red' }}>{error}</p>
      )}
      <div>
        <label>
          Date (YYYY-MM-DD):&nbsp;
          <input
            type="text"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="2026-06-15"
            required
          />
        </label>
      </div>
      <div>
        <label>
          Case Label:&nbsp;
          <input
            type="text"
            value={caseLabel}
            onChange={(e) => setCaseLabel(e.target.value)}
            placeholder="Smith v. Jones"
            required
          />
        </label>
      </div>
      <div>
        <label>
          Type ID (number):&nbsp;
          <input
            type="number"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            placeholder="1"
            min="1"
            required
          />
        </label>
      </div>
      <div>
        <label>
          Description:&nbsp;
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />
        </label>
      </div>
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Save Deadline'}
      </button>
    </form>
  )
}

function DeadlinesTable() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['deadlines'],
    queryFn: getDeadlines,
  })

  if (isLoading) return <p>Loading...</p>
  if (isError) return <p style={{ color: 'red' }}>Failed to load deadlines.</p>
  if (!data || data.length === 0) return <p>No deadlines yet. Create one above.</p>

  return (
    <table border={1} cellPadding={4} style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr>
          <th>ID</th>
          <th>Date</th>
          <th>Case Label</th>
          <th>Type ID</th>
          <th>Description</th>
          <th>Created At</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            <td>{row.id}</td>
            <td>{row.date}</td>
            <td>{row.caseLabel}</td>
            <td>{row.typeId}</td>
            <td>{row.description ?? ''}</td>
            <td>{row.createdAt}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div style={{ padding: '1rem' }}>
        <h1>Case Calendar</h1>
        <DeadlineForm />
        <h2>Saved Deadlines</h2>
        <DeadlinesTable />
      </div>
    </QueryClientProvider>
  )
}
