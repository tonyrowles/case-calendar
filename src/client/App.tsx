import React from 'react'
import { DeadlineForm } from './components/DeadlineForm.js'
import { DeadlinesTable } from './components/DeadlinesTable.js'

export function App() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-semibold mb-8">Case Calendar</h1>

        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <DeadlineForm />
        </section>

        <section className="rounded-lg border bg-card mt-8">
          <h2 className="text-xl font-semibold px-4 pt-4 pb-2">Saved Deadlines</h2>
          <DeadlinesTable />
        </section>
      </main>
    </div>
  )
}

export default App
