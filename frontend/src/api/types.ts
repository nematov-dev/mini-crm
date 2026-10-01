export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost'
export type LeadSource = 'website' | 'referral' | 'social' | 'ads' | 'cold_call' | 'event' | 'other'

export interface UserShort {
  id: number
  username: string
  full_name: string
}

export interface Me extends UserShort {
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
}

export interface Lead {
  id: number
  name: string
  email: string
  phone: string
  source: LeadSource
  source_display: string
  status: LeadStatus
  status_display: string
  note: string
  owner: UserShort | null
  created_at: string
  updated_at: string
}

export interface LeadInput {
  name: string
  email?: string
  phone?: string
  source?: LeadSource
  status?: LeadStatus
  note?: string
  owner_id?: number | null
}

export interface Paginated<T> {
  count: number
  page: number
  page_size: number
  total_pages: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface LeadActivity {
  id: number
  action: 'created' | 'updated' | 'status_changed'
  action_display: string
  actor: UserShort | null
  changes: Record<string, { from: unknown; to: unknown }>
  created_at: string
}

export interface CountItem {
  key: string
  label: string
  count: number
}

export interface LeadStats {
  total: number
  new_this_week: number
  conversion_rate: number
  by_status: CountItem[]
  by_source: CountItem[]
  daily: { date: string; count: number }[]
}

export interface LeadListParams {
  page?: number
  page_size?: number
  search?: string
  status?: LeadStatus[]
  source?: LeadSource[]
  owner?: number
  ordering?: string
}

/** Shape of every error returned by the backend (see config/exceptions.py). */
export interface ApiError {
  error: {
    code: string
    message: string
    details: Record<string, string[]> | null
  }
}
