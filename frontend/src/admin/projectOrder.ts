import type { AdminProjectSummary } from '../api/admin'

export function moveBeforeOrAfter(projects: AdminProjectSummary[], sourceId: number, targetId: number, after: boolean) {
  const from = projects.findIndex((project) => project.id === sourceId)
  const target = projects.findIndex((project) => project.id === targetId)
  if (from < 0 || target < 0 || from === target) return projects
  const next = [...projects]
  const [moved] = next.splice(from, 1)
  const insertion = target + (after ? 1 : 0) - (from < target + (after ? 1 : 0) ? 1 : 0)
  next.splice(insertion, 0, moved)
  return next
}
