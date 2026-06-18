// API base URL for the admin portal.
// In production the admin SWA proxies /api/* to the linked Function App (Standard tier).
// In local dev, Vite proxies /api/* to http://localhost:7071 (see vite.config.js).
const API_BASE = '/api'

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.error || `HTTP ${res.status}`)
    err.status = res.status
    err.body = body
    throw err
  }
  return res
}

export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options)
  return res.json()
}

// Schools
export const listSchools = (params = {}) =>
  apiJson(`/manage/schools?${new URLSearchParams(params)}`)

export const validateSchool = (id) =>
  apiJson(`/manage/schools/${id}/validate`, { method: 'POST' })

export const mergeSchools = (sourceSchoolId, targetSchoolId) =>
  apiJson('/manage/schools/merge', {
    method: 'POST',
    body: JSON.stringify({ sourceSchoolId, targetSchoolId }),
  })

// Institutions
export const createInstitution = (data) =>
  apiJson('/manage/institutions', { method: 'POST', body: JSON.stringify(data) })

export const createInvite = (schoolId) =>
  apiJson(`/manage/institutions/${schoolId}/invite`, { method: 'POST' })

// Teachers
export const listTeachers = (params = {}) =>
  apiJson(`/manage/teachers?${new URLSearchParams(params)}`)

export const setTeacherRole = (id, role) =>
  apiJson(`/manage/teachers/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) })

// Metrics
export const getMetrics = (range = 'today') =>
  apiJson(`/manage/metrics?range=${range}`)

// Logs
export function buildLogsExportUrl(type, from, to) {
  const params = new URLSearchParams({ type })
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return `${API_BASE}/manage/logs/export?${params}`
}

// Audit log
export const listAuditEntries = (params = {}) =>
  apiJson(`/manage/audit?${new URLSearchParams(params)}`)
