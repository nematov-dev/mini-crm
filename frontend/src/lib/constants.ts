import type { LeadSource, LeadStatus } from '../api/types'

export const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'blue' },
  { value: 'contacted', label: 'Contacted', color: 'gold' },
  { value: 'qualified', label: 'Qualified', color: 'purple' },
  { value: 'won', label: 'Won', color: 'green' },
  { value: 'lost', label: 'Lost', color: 'red' },
]

export const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'social', label: 'Social media' },
  { value: 'ads', label: 'Advertising' },
  { value: 'cold_call', label: 'Cold call' },
  { value: 'event', label: 'Event' },
  { value: 'other', label: 'Other' },
]

export const statusMeta = (status: string) =>
  STATUS_OPTIONS.find((s) => s.value === status) ?? { value: status, label: status, color: 'default' }

export const sourceLabel = (source: string) => SOURCE_OPTIONS.find((s) => s.value === source)?.label ?? source

export const DATE_FORMAT = 'DD.MM.YYYY HH:mm'
