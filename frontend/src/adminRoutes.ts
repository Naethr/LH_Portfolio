export type AdminSection = 'dashboard' | 'projects' | 'project-new' | 'project-edit' | 'profile' | 'missing'

export function getAdminProjectId(pathname: string): number | null {
  const match = /^\/admin\/projects\/([1-9]\d*)\/edit\/?$/.exec(pathname)
  if (!match) return null
  const id = Number(match[1])
  return Number.isSafeInteger(id) ? id : null
}

export function getAdminSection(pathname: string): AdminSection {
  const route = pathname.replace(/\/+$/, '') || '/'
  return route === '/admin' ? 'dashboard'
    : route === '/admin/projects' ? 'projects'
      : route === '/admin/projects/new' ? 'project-new'
        : getAdminProjectId(route) !== null ? 'project-edit'
          : route === '/admin/profile' ? 'profile' : 'missing'
}
