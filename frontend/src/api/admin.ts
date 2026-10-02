export interface AdminUser {
  email_address: string
}

export class AdminApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Admin API returned ${status}`)
    this.status = status
  }
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
  })
  if (!response.ok) throw new AdminApiError(response.status)
  return response
}

async function csrfToken() {
  const response = await request('/csrf')
  const data: { csrf_token: string } = await response.json()
  return data.csrf_token
}

export async function getAdminSession(signal?: AbortSignal): Promise<AdminUser> {
  const response = await request('/admin/session', { signal })
  const data: { user: AdminUser } = await response.json()
  return data.user
}

export async function logIn(emailAddress: string, password: string): Promise<void> {
  const token = await csrfToken()
  await request('/admin/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email_address: emailAddress, password }),
  })
}

export async function logOut(): Promise<void> {
  const token = await csrfToken()
  await request('/admin/session', {
    method: 'DELETE',
    headers: { 'X-CSRF-Token': token },
  })
}
