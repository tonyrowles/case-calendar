/**
 * Debug CLI: parse a single free-text input via the NL parser and print the JSON result.
 * Usage: npm run parse:once -- "Smith deposition June 15"
 *
 * Loads ANTHROPIC_API_KEY from .env.local; if unset, prints a clear error and exits 1.
 * Useful for tuning the system prompt without redeploying the server.
 */
import dotenv from 'dotenv'
import { parseDeadline, ParserUnconfiguredError } from '../lib/nl-parser.js'
import { getAllDeadlineTypes } from '../queries.js'
import { toISODateString } from '../../shared/lib/date.js'

async function main(): Promise<void> {
  dotenv.config({ path: '.env.local' })

  const text = process.argv.slice(2).join(' ').trim()
  if (!text) {
    console.error('Usage: npm run parse:once -- "<your deadline text>"')
    process.exit(1)
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set in .env.local. See docs/DEPLOYMENT.md#nl-quick-add-phase-11')
    process.exit(1)
  }

  try {
    const types = getAllDeadlineTypes()
    const typeNames = types.map(t => t.name)
    const today = toISODateString(new Date())
    const parsed = await parseDeadline(text, typeNames, today)

    // Resolve typeName -> typeId (matches Plan 02 route logic for consistency)
    const normalized = parsed.typeName.toLowerCase()
    const matched = types.find(t => t.name.toLowerCase() === normalized)
    const otherType = types.find(t => t.name.toLowerCase() === 'other')
    const typeId = matched?.id ?? otherType?.id ?? null

    console.log(JSON.stringify({
      caseLabel: parsed.caseLabel,
      typeName: parsed.typeName,
      typeId,
      date: parsed.date,
      description: parsed.description,
    }, null, 2))
    process.exit(0)
  } catch (err) {
    if (err instanceof ParserUnconfiguredError) {
      console.error('Parser unconfigured:', err.message)
      process.exit(1)
    }
    console.error('Parse failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

void main()
