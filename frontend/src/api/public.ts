export interface Profile {
  display_name: string
  headline: string | null
  bio: string | null
  email: string | null
  instagram_url: string | null
  linkedin_url: string | null
}

export interface ProjectImage {
  asset_kind: 'artwork' | 'mockup'
  position: number
  is_primary: boolean
  alt_text: string
  caption: string | null
  image_url: string
}

export interface ProjectSummary {
  title: string
  slug: string
  summary: string | null
  category: string | null
  year: number | null
  featured: boolean
  primary_image: ProjectImage | null
}

export interface ProjectDetail extends Omit<ProjectSummary, 'primary_image'> {
  description: string | null
  client: string | null
  images: ProjectImage[]
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(status === 404 ? 'Contenu introuvable.' : 'Le contenu est momentanément indisponible.')
    this.status = status
  }
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) throw new ApiError(response.status)
  return response.json() as Promise<T>
}

export const getProfile = (signal?: AbortSignal) => getJson<Profile>('/profile', signal)
export const getProjects = (signal?: AbortSignal) =>
  getJson<ProjectSummary[]>('/projects', signal).then((projects) =>
    projects.sort((left, right) => left.slug.localeCompare(right.slug)),
  )
export const getProject = (slug: string, signal?: AbortSignal) =>
  getJson<ProjectDetail>(`/projects/${encodeURIComponent(slug)}`, signal)
