import type { FormInstance } from 'antd'
import { isAxiosError } from 'axios'
import type { ApiError } from '../api/types'

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isAxiosError<ApiError>(error)) {
    if (!error.response) return 'Network error: the server is unreachable.'
    const apiError = error.response.data?.error
    const nonField = apiError?.details?.non_field_errors?.[0]
    return nonField ?? apiError?.message ?? fallback
  }
  return fallback
}

/**
 * Puts backend validation errors ({"email": ["..."]}) onto the matching
 * form fields. Returns true if at least one field error was applied.
 */
export function applyFieldErrors(form: FormInstance, error: unknown): boolean {
  if (!isAxiosError<ApiError>(error)) return false
  const details = error.response?.data?.error?.details
  if (!details) return false

  const known = new Set(Object.keys(form.getFieldsValue(true)))
  const fields = Object.entries(details)
    .filter(([name]) => known.has(name))
    .map(([name, errors]) => ({ name, errors }))
  form.setFields(fields)
  return fields.length > 0
}
