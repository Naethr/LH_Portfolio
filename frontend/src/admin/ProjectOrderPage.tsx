import { useEffect, useState, type CSSProperties, type DragEvent } from 'react'
import { AdminApiError, getAdminProjects, reorderAdminProjects, type AdminProjectSummary } from '../api/admin'
import { getProjects, type ProjectSummary } from '../api/public'
import { moveBeforeOrAfter } from './projectOrder'

type OrderState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; saved: AdminProjectSummary[]; working: AdminProjectSummary[] }

type PreviewState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; projects: ProjectSummary[] }

const categories = ['Tous', 'Affiches', 'Programmes', 'Livres'] as const
const tones = ['#dce3e7', '#e5e0d4', '#d4dfdf', '#e8e2d6', '#dce0e9', '#e2e3db']

function PreviewCard({ project, index }: { project: ProjectSummary; index: number }) {
  return <div className="project" style={{ '--tone': tones[index % tones.length] } as CSSProperties}>
    <span className="frame">
      {project.primary_image ? <img src={project.primary_image.image_url} alt={project.primary_image.alt_text || project.title} loading="lazy" /> : <span className="image-missing">Image à venir</span>}
    </span>
    <span className="project-meta"><span className="project-title">{project.title}</span><span className="project-type">{project.category}</span></span>
    {project.summary && <span className="project-sub">{project.summary}</span>}
  </div>
}

export function ProjectOrderPage() {
  const [state, setState] = useState<OrderState>({ status: 'loading' })
  const [preview, setPreview] = useState<PreviewState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const [filter, setFilter] = useState<string>('Tous')
  const [visible, setVisible] = useState(12)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [dragId, setDragId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: number; after: boolean } | null>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getAdminProjects(controller.signal).then((projects) => {
      if (!controller.signal.aborted) setState({ status: 'ready', saved: projects, working: projects })
    }).catch((loadError: unknown) => {
      if (controller.signal.aborted) return
      if (loadError instanceof AdminApiError && loadError.status === 401) window.location.replace('/admin/login')
      else setState({ status: 'error' })
    })
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    const controller = new AbortController()
    getProjects(controller.signal).then((projects) => {
      if (!controller.signal.aborted) setPreview({ status: 'ready', projects })
    }).catch(() => {
      if (!controller.signal.aborted) setPreview({ status: 'error' })
    })
    return () => controller.abort()
  }, [previewAttempt])

  const dirty = state.status === 'ready' && state.working.some((project, index) => project.id !== state.saved[index]?.id)

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function changeOrder(next: AdminProjectSummary[]) {
    if (saving || state.status !== 'ready') return
    setState({ ...state, working: next })
    setFeedback('')
    setError('')
  }

  function moveBy(id: number, direction: -1 | 1) {
    if (state.status !== 'ready') return
    const index = state.working.findIndex((project) => project.id === id)
    const neighbor = state.working[index + direction]
    if (!neighbor) return
    changeOrder(moveBeforeOrAfter(state.working, id, neighbor.id, direction === 1))
    setAnnouncement(`${state.working[index].title} déplacé en position ${index + direction + 1}.`)
  }

  function onDragStart(event: DragEvent<HTMLButtonElement>, id: number) {
    if (saving) { event.preventDefault(); return }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(id))
    setDragId(id)
    setFeedback('')
  }

  function onDragOver(event: DragEvent<HTMLLIElement>, id: number) {
    if (dragId === null || dragId === id || saving) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const after = event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2
    setDropTarget((previous) => previous?.id === id && previous.after === after ? previous : { id, after })
  }

  function onDrop(event: DragEvent<HTMLLIElement>, id: number) {
    event.preventDefault()
    if (state.status === 'ready' && dragId !== null && dragId !== id && !saving && event.dataTransfer.getData('text/plain') === String(dragId)) {
      const after = event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2
      const next = moveBeforeOrAfter(state.working, dragId, id, after)
      changeOrder(next)
      setAnnouncement(`${state.working.find((project) => project.id === dragId)?.title} déplacé en position ${next.findIndex((project) => project.id === dragId) + 1}.`)
    }
    setDragId(null)
    setDropTarget(null)
  }

  async function saveOrder() {
    if (state.status !== 'ready' || !dirty || saving) return
    const requestedIds = state.working.map((project) => project.id)
    setSaving(true)
    setFeedback('')
    setError('')
    try {
      const savedIds = await reorderAdminProjects(requestedIds)
      if (savedIds.length !== requestedIds.length || savedIds.some((id, index) => id !== requestedIds[index])) {
        throw new Error('Réponse de réorganisation inattendue.')
      }
      try {
        const projects = await getAdminProjects()
        setState({ status: 'ready', saved: projects, working: projects })
        setFeedback('Ordre enregistré. La liste a été rechargée depuis Rails.')
      } catch (reloadError) {
        if (reloadError instanceof AdminApiError && reloadError.status === 401) window.location.replace('/admin/login')
        setState({ status: 'ready', saved: state.working, working: state.working })
        setFeedback('Ordre enregistré. La relecture a échoué ; rechargez la page pour vérifier la liste.')
      }
    } catch (saveError) {
      if (saveError instanceof AdminApiError && saveError.status === 401) {
        window.location.replace('/admin/login')
      } else if (saveError instanceof AdminApiError && saveError.status === 422) {
        setError('Rails a refusé cet ordre. La liste des projets a peut-être changé ; vos déplacements restent visibles. Rechargez la page pour récupérer la liste actuelle.')
      } else {
        setError('Impossible d’enregistrer l’ordre. Vos déplacements sont conservés ; réessayez.')
      }
    } finally {
      setSaving(false)
    }
  }

  const working = state.status === 'ready' ? state.working : []
  const published = working.filter((project) => project.published)
  const previewBySlug = new Map(preview.status === 'ready' ? preview.projects.map((project) => [project.slug, project]) : [])
  const publicItems = published.map((project) => previewBySlug.get(project.slug)).filter((project): project is ProjectSummary => Boolean(project))
  const core = publicItems.filter((project) => project.category !== 'Explorations')
  const extras = publicItems.filter((project) => project.category === 'Explorations')
  const filtered = filter === 'Tous' ? core : core.filter((project) => project.category === filter)

  return <>
    <a className="admin-back-link" href="/admin/projects">← Retour aux projets</a>
    <div className="admin-page-heading">
      <div><p className="admin-kicker">Projets</p><h1>Organiser les créations</h1></div>
    </div>
    <p className="admin-lead">Réorganisez tous les projets, puis enregistrez. Les brouillons gardent leur place dans l’ordre interne ; seules les créations publiées apparaissent dans la prévisualisation.</p>
    {state.status === 'loading' && <p className="admin-state admin-state-loading" role="status">Chargement de l’ordre des projets…</p>}
    {state.status === 'error' && <div className="admin-state admin-state-error" role="alert"><p>Impossible de charger l’ordre des projets.</p><button className="admin-secondary-button" type="button" onClick={() => { setState({ status: 'loading' }); setAttempt((value) => value + 1) }}>Réessayer</button></div>}
    {state.status === 'ready' && <>
      <p className="admin-screen-reader-only" role="status">{announcement}</p>
      <div className="admin-order-actions">
        <p className={dirty ? 'admin-order-dirty' : 'admin-order-clean'} role="status">{saving ? 'Enregistrement en cours…' : dirty ? 'Modifications non enregistrées' : 'Ordre enregistré'}</p>
        <div className="admin-order-buttons">
          <button className="admin-secondary-button" type="button" disabled={!dirty || saving} onClick={() => { setState({ ...state, working: state.saved }); setError(''); setFeedback('Changements annulés.') }}>Annuler les changements</button>
          <button className="admin-button" type="button" disabled={!dirty || saving} onClick={saveOrder}>{saving ? 'Enregistrement…' : 'Enregistrer l’ordre'}</button>
        </div>
      </div>
      {feedback && <p className="admin-notice" role="status">{feedback}</p>}
      {error && <p className="admin-inline-alert" role="alert">{error}</p>}
      {working.length === 0 ? <p className="admin-state admin-state-empty">Aucun projet à organiser pour le moment.</p> : <div className="admin-order-layout">
        <section className="admin-order-list-section" aria-labelledby="admin-order-list-title">
          <h2 id="admin-order-list-title">Ordre de tous les projets</h2>
          <p>Glissez un projet ou utilisez les boutons Monter et Descendre. Chaque déplacement met la prévisualisation à jour immédiatement.</p>
          <ol className="admin-order-list">
            {working.map((project, index) => <li key={project.id} className={`admin-order-item${dragId === project.id ? ' is-dragging' : ''}${dropTarget?.id === project.id ? ` is-drop-${dropTarget.after ? 'after' : 'before'}` : ''}`} onDragOver={(event) => onDragOver(event, project.id)} onDrop={(event) => onDrop(event, project.id)}>
              <button className="admin-order-handle" type="button" draggable={!saving && working.length > 1} disabled={saving || working.length < 2} onDragStart={(event) => onDragStart(event, project.id)} onDragEnd={() => { setDragId(null); setDropTarget(null) }} aria-label={`Glisser pour déplacer ${project.title}`} title="Glisser pour déplacer">⋮⋮</button>
              <span className="admin-order-number" aria-label={`Rang ${index + 1}`}>{index + 1}</span>
              <div className="admin-order-details"><strong>{project.title}</strong><span>{project.category || 'Sans catégorie'} · position enregistrée {project.position}</span><span className={project.published ? 'admin-status admin-status-published' : 'admin-status admin-status-draft'}>{project.published ? 'Publié' : 'Brouillon'}</span></div>
              <div className="admin-order-move">
                <button type="button" className="admin-secondary-button" disabled={saving || index === 0} aria-label={`Monter ${project.title}`} onClick={() => moveBy(project.id, -1)}>↑ <span>Monter</span></button>
                <button type="button" className="admin-secondary-button" disabled={saving || index === working.length - 1} aria-label={`Descendre ${project.title}`} onClick={() => moveBy(project.id, 1)}>↓ <span>Descendre</span></button>
              </div>
            </li>)}
          </ol>
        </section>
        <section className="admin-order-preview" aria-labelledby="admin-order-preview-title">
          <div className="admin-order-preview-heading"><h2 id="admin-order-preview-title">Prévisualisation publique</h2><p>{published.length} projet{published.length > 1 ? 's' : ''} publié{published.length > 1 ? 's' : ''}</p></div>
          {preview.status === 'loading' && <p className="admin-state admin-state-loading" role="status">Chargement des visuels publics…</p>}
          {preview.status === 'error' && <div className="admin-state admin-state-error" role="alert"><p>La prévisualisation est indisponible pour le moment. L’ordre admin reste modifiable.</p><button className="admin-secondary-button" type="button" onClick={() => { setPreview({ status: 'loading' }); setPreviewAttempt((value) => value + 1) }}>Réessayer</button></div>}
          {preview.status === 'ready' && <>
            {published.length === 0 ? <p className="admin-state admin-state-empty">Aucune création publiée à prévisualiser.</p> : <>
              {publicItems.length !== published.length && <p className="admin-inline-alert" role="alert">Certains projets publiés ne sont pas encore présents dans l’API publique. Leur prévisualisation est incomplète.</p>}
              <div className="admin-preview-public"><div className="work-section"><div className="section-head"><h3>Créations</h3></div><div className="filters" aria-label="Filtrer la prévisualisation">{categories.map((category) => <button className="filter" type="button" key={category} aria-pressed={filter === category} onClick={() => { setFilter(category); setVisible(12) }}>{category === 'Tous' ? 'Tout voir' : category}</button>)}</div>
                {filtered.length === 0 ? <p className="admin-preview-empty">Aucune création publiée dans cette catégorie.</p> : <><div className="grid">{filtered.slice(0, visible).map((project, index) => <PreviewCard key={project.slug} project={project} index={index} />)}</div>{visible < filtered.length && <div className="more-row"><button className="btn btn-outline" type="button" onClick={() => setVisible((count) => count + 12)}>Voir plus de créations</button></div>}</>}
                {extras.length > 0 && <div className="admin-preview-extras"><h3>Et parfois, hors cadre.</h3><div className="grid small-grid">{extras.map((project, index) => <PreviewCard key={project.slug} project={project} index={index} />)}</div></div>}
              </div></div>
            </>}
          </>}
        </section>
      </div>}
    </>}
  </>
}
