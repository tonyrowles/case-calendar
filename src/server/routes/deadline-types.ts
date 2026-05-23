import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  deadlineTypeCreateSchema,
  deadlineTypeUpdateSchema,
} from '../../shared/schemas/deadlineType.js'
import {
  getAllDeadlineTypes,
  createDeadlineType,
  updateDeadlineType,
  deleteDeadlineType,
  getDeadlineTypeById,
  countDeadlinesByType,
} from '../queries.js'
import { type AppVariables } from '../middleware/user-context.js'
import { logger } from '../logger.js'

export const deadlineTypesRouter = new Hono<{ Variables: AppVariables }>()

deadlineTypesRouter.get('/deadline-types', (c) => {
  try {
    const data = getAllDeadlineTypes()
    return c.json(data)
  } catch (err) {
    logger.error({ err }, 'GET /deadline-types failed')
    return c.json({ error: { code: 'db_error', message: 'Database read failed.' } }, 500)
  }
})

// POST /api/deadline-types — create a new type (TYPE-01)
deadlineTypesRouter.post(
  '/deadline-types',
  zValidator('json', deadlineTypeCreateSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'validation_failed', message: 'One or more fields are invalid.' } },
        422
      )
    }
  }),
  (c) => {
    const data = c.req.valid('json')
    try {
      const type = createDeadlineType(data)
      return c.json(type, 201)
    } catch (err: unknown) {
      // SQLite UNIQUE constraint violation → 409 type_name_taken
      if (isUniqueConstraintError(err)) {
        return c.json(
          { error: { code: 'type_name_taken', message: 'A type with that name already exists.' } },
          409
        )
      }
      logger.error({ err }, 'POST /deadline-types failed')
      return c.json({ error: { code: 'db_error', message: "Couldn't save to database." } }, 500)
    }
  }
)

// PATCH /api/deadline-types/:id — rename or recolor (TYPE-02/03)
deadlineTypesRouter.patch(
  '/deadline-types/:id',
  zValidator('json', deadlineTypeUpdateSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'validation_failed', message: 'One or more fields are invalid.' } },
        422
      )
    }
  }),
  (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: { code: 'validation_failed', message: 'Invalid id' } }, 400)
    }
    const patch = c.req.valid('json')
    try {
      const updated = updateDeadlineType(id, patch)
      if (!updated) {
        return c.json({ error: { code: 'not_found', message: 'Type not found' } }, 404)
      }
      return c.json(updated)
    } catch (err: unknown) {
      if (isUniqueConstraintError(err)) {
        return c.json(
          { error: { code: 'type_name_taken', message: 'A type with that name already exists.' } },
          409
        )
      }
      logger.error({ err, id }, 'PATCH /deadline-types/:id failed')
      return c.json({ error: { code: 'db_error', message: "Couldn't update type." } }, 500)
    }
  }
)

// DELETE /api/deadline-types/:id — delete with guards (TYPE-04/05)
// Guard order: parse id → 404 check → "Other" protected check (case-insensitive) → in-use check → delete
deadlineTypesRouter.delete('/deadline-types/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: { code: 'validation_failed', message: 'Invalid id' } }, 400)
  }

  const type = getDeadlineTypeById(id)
  if (!type) {
    return c.json({ error: { code: 'not_found', message: 'Type not found' } }, 404)
  }

  // T-04-02-03: case-insensitive "Other" check prevents bypass via OTHER / other (Common Pitfall #6)
  if (type.name.toLowerCase() === 'other') {
    return c.json(
      { error: { code: 'type_protected', message: 'The "Other" type cannot be deleted.' } },
      409
    )
  }

  const count = countDeadlinesByType(id)
  if (count > 0) {
    return c.json(
      {
        error: {
          code: 'type_in_use',
          message: `Cannot delete: ${count} deadlines use this type. Reassign them first.`,
        },
      },
      409
    )
  }

  try {
    deleteDeadlineType(id)
    return c.body(null, 204)
  } catch (err) {
    logger.error({ err, id }, 'DELETE /deadline-types/:id failed')
    return c.json({ error: { code: 'db_error', message: "Couldn't delete type." } }, 500)
  }
})

/**
 * Check if an error is a SQLite UNIQUE constraint violation.
 * better-sqlite3 uses err.code === 'SQLITE_CONSTRAINT_UNIQUE' or
 * message includes 'UNIQUE constraint failed'.
 */
function isUniqueConstraintError(err: unknown): boolean {
  if (err instanceof Error) {
    const e = err as Error & { code?: string }
    return (
      e.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      e.message.includes('UNIQUE constraint failed')
    )
  }
  return false
}
