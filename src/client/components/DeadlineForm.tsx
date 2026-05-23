import React, { useState, useEffect, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Loader2, CalendarIcon } from 'lucide-react'

import { deadlineCreateSchema } from '@/shared/schemas/deadline.js'
import type { DeadlineCreate, Deadline } from '@/shared/schemas/deadline.js'
import { parseLocalDate, toISODateString } from '@/shared/lib/date.js'
import { createDeadline, getDeadlineTypes } from '@/client/lib/api.js'
import { useDeadlineMutations } from '@/client/hooks/useDeadlineMutations.js'

import { Button } from '@/client/components/ui/button.js'
import { Input } from '@/client/components/ui/input.js'
import { Textarea } from '@/client/components/ui/textarea.js'
import { Label } from '@/client/components/ui/label.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select.js'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/client/components/ui/popover.js'
import { Calendar } from '@/client/components/ui/calendar.js'
import { ErrorBanner } from './ErrorBanner.js'

export interface DeadlineFormProps {
  /** YYYY-MM-DD string; when changed, drives the date field via setValue + scrolls form + focuses case-label input */
  selectedDate?: string
  /** When set, the form is in edit mode — fields prefilled from this deadline */
  deadline?: Deadline | null
  /** Called when the Cancel button is clicked in edit mode */
  onCancel?: () => void
  /** Called after a successful save (edit or create) — parent uses this to clear selectedDeadlineId */
  onSuccess?: () => void
}

export function DeadlineForm({ selectedDate, deadline, onCancel, onSuccess }: DeadlineFormProps = {}) {
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dateOpen, setDateOpen] = useState(false)
  const queryClient = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)

  // Edit mode flag — true when a deadline is being edited
  const isEdit = deadline != null

  const typesQuery = useQuery({
    queryKey: ['deadline-types'],
    queryFn: getDeadlineTypes,
  })

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<DeadlineCreate>({
    resolver: zodResolver(deadlineCreateSchema),
    defaultValues: {
      date: '',
      caseLabel: '',
      typeId: undefined as unknown as number,
      description: '',
    },
  })

  // Centralized mutations (for edit mode PATCH)
  const mutations = useDeadlineMutations()

  // Create mutation (kept here for backward compat with Phase 1 tests)
  const createMutation = useMutation({
    mutationFn: createDeadline,
    onSuccess: () => {
      setSaveError(null)
      reset()
      queryClient.invalidateQueries({ queryKey: ['deadlines'] })
      queryClient.invalidateQueries({ queryKey: ['case-labels'] })
      onSuccess?.()
    },
    onError: (err: Error) => {
      setSaveError(err.message)
    },
  })

  const isPending = createMutation.isPending || mutations.update.isPending

  // Track the previous deadline id to distinguish initial mount (deadline=null) from
  // a transition from edit→create (deadline was set, then cleared).
  const prevDeadlineIdRef = useRef<number | undefined>(undefined)

  // When the deadline prop changes (edit mode mount/unmount):
  // - deadline truthy → prefill form with deadline values + focus caseLabel
  // - deadline becomes null AFTER having been set → reset to empty defaults
  // - initial mount with deadline=null → do nothing (avoids clobbering selectedDate effect)
  useEffect(() => {
    const prevId = prevDeadlineIdRef.current
    const currentId = deadline?.id
    prevDeadlineIdRef.current = currentId

    if (deadline) {
      // Entering edit mode
      reset({
        date: deadline.date,
        caseLabel: deadline.caseLabel,
        typeId: deadline.typeId,
        description: deadline.description ?? '',
      })
      setFocus('caseLabel')
    } else if (prevId !== undefined && currentId === undefined) {
      // Transitioning from edit → create: clear the form
      reset({
        date: '',
        caseLabel: '',
        typeId: undefined as unknown as number,
        description: '',
      })
    }
    // Initial mount with deadline=null: no-op (selectedDate effect handles pre-fill)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline?.id])

  // When selectedDate changes (set by CalendarView dateClick), pre-fill the date
  // field, scroll the form into view, and focus the case-label input so the
  // user can immediately type the case name.
  // Only active in create mode (when isEdit is false) — avoids clobbering edit prefill.
  useEffect(() => {
    if (!selectedDate || isEdit) return
    setValue('date', selectedDate, { shouldValidate: true, shouldDirty: true })
    // scrollIntoView is a browser API; jsdom stubs it only in some environments
    if (typeof formRef.current?.scrollIntoView === 'function') {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setFocus('caseLabel')
  }, [selectedDate, setValue, setFocus, isEdit])

  async function onSubmit(data: DeadlineCreate) {
    if (isEdit && deadline) {
      try {
        await mutations.update.mutateAsync({ id: deadline.id, patch: data })
        setSaveError(null)
        onSuccess?.()
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Update failed. Try again.')
      }
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(onSubmit)}
      autoComplete="off"
      className="space-y-4"
    >
      {isEdit ? (
        <h2 className="text-xl font-semibold">
          Edit Deadline
          <span className="text-xs font-semibold text-muted-foreground ml-2 align-middle">(editing)</span>
        </h2>
      ) : (
        <h2 className="text-xl font-semibold">Add Deadline</h2>
      )}

      {/* Date + Case row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Date field — Popover + Calendar */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="date-trigger" className="text-sm font-semibold">
            Date
          </Label>
          <Controller
            name="date"
            control={control}
            render={({ field }) => {
              const selectedDateVal = field.value ? parseLocalDate(field.value) ?? undefined : undefined
              return (
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="date-trigger"
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left min-h-[44px] font-normal"
                      aria-describedby={errors.date ? 'date-error' : undefined}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      {selectedDateVal ? format(selectedDateVal, 'MMMM d, yyyy') : (
                        <span className="text-muted-foreground">Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDateVal}
                      onSelect={(date) => {
                        field.onChange(date ? toISODateString(date) : '')
                        setDateOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
              )
            }}
          />
          {errors.date && (
            <p className="text-destructive text-xs" id="date-error">
              {errors.date.message}
            </p>
          )}
        </div>

        {/* Case field */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="caseLabel" className="text-sm font-semibold">
            Case
          </Label>
          <Input
            id="caseLabel"
            placeholder="e.g. Smith v. Jones"
            autoComplete="off"
            aria-describedby={errors.caseLabel ? 'caseLabel-error' : undefined}
            {...register('caseLabel')}
          />
          {errors.caseLabel && (
            <p className="text-destructive text-xs" id="caseLabel-error">
              {errors.caseLabel.message}
            </p>
          )}
        </div>
      </div>

      {/* Type field — full width */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="type-trigger" className="text-sm font-semibold">
          Type
        </Label>
        <Controller
          name="typeId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ? String(field.value) : ''}
              onValueChange={(value) => field.onChange(Number(value))}
            >
              <SelectTrigger
                id="type-trigger"
                className="w-full min-h-[44px]"
                aria-describedby={errors.typeId ? 'typeId-error' : undefined}
              >
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {(typesQuery.data ?? []).map((type) => (
                  <SelectItem key={type.id} value={String(type.id)}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: type.color }}
                        aria-hidden="true"
                      />
                      {type.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {typesQuery.isError && (
          <p className="text-destructive text-xs" role="alert">
            Couldn't load deadline types. Refresh the page.
          </p>
        )}
        {errors.typeId && (
          <p className="text-destructive text-xs" id="typeId-error">
            {errors.typeId.message}
          </p>
        )}
      </div>

      {/* Description field — full width */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="description" className="text-sm font-semibold">
          Description
        </Label>
        <Textarea
          id="description"
          placeholder="Hearing time, motion number, filing notes…"
          autoComplete="off"
          rows={3}
          aria-describedby={errors.description ? 'description-error' : undefined}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-destructive text-xs" id="description-error">
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Error banner — above Save button (pessimistic UX: stays in edit mode on error) */}
      {saveError && (
        <ErrorBanner
          message={saveError}
          onDismiss={() => setSaveError(null)}
        />
      )}

      {/* Button row — Cancel visible in edit mode */}
      {isEdit ? (
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={isPending || typesQuery.isError || typesQuery.isLoading}
            aria-busy={isPending}
            aria-label={isPending ? 'Saving deadline' : undefined}
            className="flex-1 min-h-[44px]"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          type="submit"
          disabled={isPending || typesQuery.isError || typesQuery.isLoading}
          aria-busy={isPending}
          aria-label={isPending ? 'Saving deadline' : undefined}
          className="w-full min-h-[44px]"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            'Save Deadline'
          )}
        </Button>
      )}
    </form>
  )
}
