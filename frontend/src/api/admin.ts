export interface AdminUser {
  email_address: string
}

export interface AdminProfile {
  display_name: string
  headline: string | null
  bio: string | null
  email: string | null
  instagram_url: string | null
  linkedin_url: string | null
}

export interface AdminProjectSummary {
  id: number
  position: number
  title: string
  slug: string
  summary: string | null
  category: string | null
  year: number | null
  client: string | null
  published: boolean
  featured: boolean
}

export interface AdminProject extends AdminProjectSummary {
  description: string | null
}

export type AdminProjectInput = Omit<AdminProject, 'id' | 'position'>

export type AdminAssetKind = 'artwork' | 'mockup'

export interface AdminProjectImage {
  id: number
  asset_kind: AdminAssetKind
  position: number
  is_primary: boolean
  alt_text: string
  caption: string | null
  image_url: string
}

export interface AdminProjectImageInput {
  asset_kind: AdminAssetKind
  position: number
  is_primary: boolean
  alt_text: string
  caption: string
}

export type AdminProjectImageUpdate = Partial<AdminProjectImageInput>

export class AdminApiError extends Error {
  readonly status: number
  readonly errors: Record<string, string[]>

  constructor(status: number, errors: Record<string, string[]> = {}) {
    super(`Admin API returned ${status}`)
    this.status = status
    this.errors = errors
  }
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
  })
  if (!response.ok) {
    let errors: Record<string, string[]> = {}
    if (response.status === 422) {
      try {
        const data: { errors?: Record<string, string[]> } = await response.json()
        errors = data.errors || {}
      } catch {
        // A CSRF or infrastructure error can also return 422 without field errors.
      }
    }
    throw new AdminApiError(response.status, errors)
  }
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

export async function getAdminProfile(signal?: AbortSignal): Promise<AdminProfile> {
  const response = await request('/admin/profile', { signal })
  return response.json()
}

export async function updateAdminProfile(profile: AdminProfile): Promise<AdminProfile> {
  const token = await csrfToken()
  const response = await request('/admin/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ profile }),
  })
  return response.json()
}

function projectPath(id: number) {
  return `/admin/projects/${id}`
}

async function projectMutation(path: string, method: 'POST' | 'PATCH' | 'DELETE', project?: AdminProjectInput) {
  const token = await csrfToken()
  return request(path, {
    method,
    headers: { 'X-CSRF-Token': token, ...(project ? { 'Content-Type': 'application/json' } : {}) },
    ...(project ? { body: JSON.stringify({ project }) } : {}),
  })
}

export async function getAdminProjects(signal?: AbortSignal): Promise<AdminProjectSummary[]> {
  const response = await request('/admin/projects', { signal })
  return response.json()
}

export async function reorderAdminProjects(projectIds: number[]): Promise<number[]> {
  const token = await csrfToken()
  const response = await request('/admin/projects/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ project_ids: projectIds }),
  })
  const data: { project_ids: number[] } = await response.json()
  return data.project_ids
}

export async function getAdminProject(id: number, signal?: AbortSignal): Promise<AdminProject> {
  const response = await request(projectPath(id), { signal })
  return response.json()
}

export async function createAdminProject(project: AdminProjectInput): Promise<AdminProject> {
  const response = await projectMutation('/admin/projects', 'POST', project)
  return response.json()
}

export async function updateAdminProject(id: number, project: AdminProjectInput): Promise<AdminProject> {
  const response = await projectMutation(projectPath(id), 'PATCH', project)
  return response.json()
}

export async function deleteAdminProject(id: number): Promise<void> {
  await projectMutation(projectPath(id), 'DELETE')
}

function imagesPath(projectId: number, imageId?: number) {
  const path = `${projectPath(projectId)}/images`
  return imageId === undefined ? path : `${path}/${imageId}`
}

export async function getAdminProjectImages(projectId: number, signal?: AbortSignal): Promise<AdminProjectImage[]> {
  const response = await request(imagesPath(projectId), { signal })
  return response.json()
}

export async function uploadAdminProjectImage(projectId: number, file: File, fields: AdminProjectImageInput): Promise<AdminProjectImage> {
  const token = await csrfToken()
  const body = new FormData()
  body.append('project_image[image]', file)
  body.append('project_image[asset_kind]', fields.asset_kind)
  body.append('project_image[position]', String(fields.position))
  body.append('project_image[is_primary]', String(fields.is_primary))
  body.append('project_image[alt_text]', fields.alt_text)
  body.append('project_image[caption]', fields.caption)
  const response = await request(imagesPath(projectId), {
    method: 'POST',
    headers: { 'X-CSRF-Token': token },
    body,
  })
  return response.json()
}

export async function updateAdminProjectImage(projectId: number, imageId: number, fields: AdminProjectImageUpdate): Promise<AdminProjectImage> {
  const token = await csrfToken()
  const response = await request(imagesPath(projectId, imageId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ project_image: fields }),
  })
  return response.json()
}

export async function deleteAdminProjectImage(projectId: number, imageId: number): Promise<void> {
  const token = await csrfToken()
  await request(imagesPath(projectId, imageId), {
    method: 'DELETE',
    headers: { 'X-CSRF-Token': token },
  })
}
