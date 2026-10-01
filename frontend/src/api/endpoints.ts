import { api } from './client'
import type {
  Lead,
  LeadActivity,
  LeadInput,
  LeadListParams,
  LeadStats,
  LeadStatus,
  Me,
  Paginated,
  UserShort,
} from './types'

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ access: string; refresh: string }>('/auth/login/', { username, password }).then((r) => r.data),
  me: () => api.get<Me>('/auth/me/').then((r) => r.data),
  users: () => api.get<UserShort[]>('/users/').then((r) => r.data),
}

export const leadsApi = {
  list: (params: LeadListParams) => api.get<Paginated<Lead>>('/leads/', { params }).then((r) => r.data),
  get: (id: number) => api.get<Lead>(`/leads/${id}/`).then((r) => r.data),
  create: (data: LeadInput) => api.post<Lead>('/leads/', data).then((r) => r.data),
  update: (id: number, data: Partial<LeadInput>) => api.patch<Lead>(`/leads/${id}/`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/leads/${id}/`),
  changeStatus: (id: number, status: LeadStatus) =>
    api.post<Lead>(`/leads/${id}/status/`, { status }).then((r) => r.data),
  activities: (id: number, page = 1) =>
    api.get<Paginated<LeadActivity>>(`/leads/${id}/activities/`, { params: { page, page_size: 20 } }).then((r) => r.data),
  stats: () => api.get<LeadStats>('/leads/stats/').then((r) => r.data),
}
