import { useEffect, useState } from 'react'
import { AdminApiError, getAdminProjects, type AdminProjectSummary } from '../api/admin'

type ListState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; projects: AdminProjectSummary[] }

export function ProjectsPage() {
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const deleted = new URLSearchParams(window.location.search).get('deleted') === '1'

  useEffect(() => {
    const controller = new AbortController()
    getAdminProjects(controller.signal).then((projects) => {
      if (!controller.signal.aborted) setState({ status: 'ready', projects })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      if (error instanceof AdminApiError && error.status === 401) {
        window.location.replace('/admin/login')
      } else {
        setState({ status: 'error' })
      }
    })
    return () => controller.abort()
  }, [attempt])

  return <>
    <div className="admin-page-heading">
      <div>
        <p className="admin-kicker">Portfolio</p>
        <h1>Projets</h1>
      </div>
      <div className="admin-heading-actions">
        <a className="admin-secondary-button" href="/admin/projects/order">Organiser les créations</a>
        <a className="admin-primary-link" href="/admin/projects/new">Créer un projet</a>
      </div>
    </div>
    {deleted && <p className="admin-notice" role="status">Le projet a été supprimé.</p>}
    {state.status === 'loading' && <p className="admin-state admin-state-loading" role="status">Chargement des projets…</p>}
    {state.status === 'error' && <div className="admin-state admin-state-error" role="alert">
      <p>Impossible de charger les projets pour le moment.</p>
      <button className="admin-secondary-button" type="button" onClick={() => { setState({ status: 'loading' }); setAttempt((value) => value + 1) }}>Réessayer</button>
    </div>}
    {state.status === 'ready' && <>
      <p className="admin-list-count">{state.projects.length} projet{state.projects.length > 1 ? 's' : ''}</p>
      {state.projects.length === 0 ? <p className="admin-state admin-state-empty">Aucun projet pour le moment. Vous pouvez créer le premier.</p> :
        <ul className="admin-project-list">
          {state.projects.map((project) => <li className="admin-project-row" key={project.id}>
            <div className="admin-project-identity">
              <strong>{project.title}</strong>
              <span>{project.category || 'Sans catégorie'}{project.year !== null ? ` · ${project.year}` : ''}</span>
            </div>
            <div className="admin-project-status">
              <span className={project.published ? 'admin-status admin-status-published' : 'admin-status admin-status-draft'}>{project.published ? 'Publié' : 'Brouillon'}</span>
              <span className={project.featured ? 'admin-featured admin-featured-active' : 'admin-featured'}>{project.featured ? 'Mis en avant' : 'Non mis en avant'}</span>
            </div>
            <a className="admin-edit-link" href={`/admin/projects/${project.id}/edit`} aria-label={`Modifier le projet ${project.title}`}>Modifier</a>
          </li>)}
        </ul>}
    </>}
  </>
}
