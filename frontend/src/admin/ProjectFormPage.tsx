import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  AdminApiError,
  createAdminProject,
  deleteAdminProject,
  getAdminProject,
  updateAdminProject,
  type AdminProject,
  type AdminProjectInput,
} from '../api/admin'
import { ProjectImagesSection } from './ProjectImagesSection'

type TextFieldName = 'title' | 'slug' | 'summary' | 'description' | 'category' | 'year' | 'client'
type FormValues = Record<TextFieldName, string> & { published: boolean; featured: boolean }
type FieldErrors = Record<string, string[]>
const labels: Record<TextFieldName, string> = {
  title: 'Titre',
  slug: 'Slug',
  summary: 'Résumé',
  description: 'Description',
  category: 'Catégorie',
  year: 'Année',
  client: 'Client',
}
const emptyValues: FormValues = {
  title: '', slug: '', summary: '', description: '', category: '', year: '', client: '', published: false, featured: false,
}

function valuesFromProject(project: AdminProject): FormValues {
  return {
    title: project.title,
    slug: project.slug,
    summary: project.summary || '',
    description: project.description || '',
    category: project.category || '',
    year: project.year === null ? '' : String(project.year),
    client: project.client || '',
    published: project.published,
    featured: project.featured,
  }
}

function projectInput(values: FormValues): AdminProjectInput {
  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    summary: values.summary.trim() || null,
    description: values.description.trim() || null,
    category: values.category.trim() || null,
    year: values.year.trim() === '' ? null : Number(values.year),
    client: values.client.trim() || null,
    published: values.published,
    featured: values.featured,
  }
}

function ProjectField({ name, value, onChange, errors, hint, multiline, required, type = 'text' }: {
  name: TextFieldName
  value: string
  onChange: (name: TextFieldName, value: string) => void
  errors: string[] | undefined
  hint?: string
  multiline?: boolean
  required?: boolean
  type?: string
}) {
  const id = `project-${name}`
  const describedBy = [hint && `${id}-hint`, errors?.length && `${id}-error`].filter(Boolean).join(' ') || undefined
  const common = {
    id,
    name,
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(name, event.target.value),
    'aria-invalid': errors?.length ? true : undefined,
    'aria-describedby': describedBy,
    required,
  }

  return <div className={`admin-form-field${multiline ? ' admin-form-field-wide' : ''}`}>
    <label htmlFor={id}>{labels[name]}{required && <span aria-hidden="true"> *</span>}</label>
    {multiline ? <textarea {...common} rows={name === 'description' ? 7 : 3} /> : <input {...common} type={type} step={type === 'number' ? 1 : undefined} />}
    {hint && <p className="admin-field-hint" id={`${id}-hint`}>{hint}</p>}
    {!!errors?.length && <p className="admin-field-error" id={`${id}-error`}>{errors.join(', ')}</p>}
  </div>
}

export function ProjectFormPage({ projectId }: { projectId?: number }) {
  const editing = projectId !== undefined
  const [values, setValues] = useState<FormValues>(emptyValues)
  const [project, setProject] = useState<AdminProject | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error' | 'missing'>(editing ? 'loading' : 'ready')
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState<'idle' | 'saving' | 'deleting'>('idle')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [requestError, setRequestError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [feedback, setFeedback] = useState(new URLSearchParams(window.location.search).get('created') === '1' ? 'Le projet a été créé.' : '')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const validationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (projectId === undefined) return
    const controller = new AbortController()
    getAdminProject(projectId, controller.signal).then((loaded) => {
      if (controller.signal.aborted) return
      setProject(loaded)
      setValues(valuesFromProject(loaded))
      setLoadState('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      if (error instanceof AdminApiError && error.status === 401) window.location.replace('/admin/login')
      else setLoadState(error instanceof AdminApiError && error.status === 404 ? 'missing' : 'error')
    })
    return () => controller.abort()
  }, [projectId, attempt])

  useEffect(() => {
    if (Object.keys(fieldErrors).length) validationRef.current?.focus()
  }, [fieldErrors])

  function changeField(name: TextFieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
    setFeedback('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy !== 'idle') return
    setRequestError('')
    setFeedback('')
    setFieldErrors({})
    const input = projectInput(values)
    if (input.year !== null && !Number.isSafeInteger(input.year)) {
      setFieldErrors({ year: ['Veuillez saisir une année entière.'] })
      return
    }
    setBusy('saving')
    try {
      const saved = editing ? await updateAdminProject(projectId, input) : await createAdminProject(input)
      if (!editing) {
        window.location.replace(`/admin/projects/${saved.id}/edit?created=1`)
      } else {
        setProject(saved)
        setValues(valuesFromProject(saved))
        setFeedback('Les modifications ont été enregistrées.')
      }
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        window.location.replace('/admin/login')
      } else if (error instanceof AdminApiError && error.status === 422 && Object.keys(error.errors).length) {
        setFieldErrors(error.errors)
      } else {
        setRequestError('Enregistrement impossible pour le moment. Réessayez.')
      }
    } finally {
      setBusy('idle')
    }
  }

  async function handleDelete() {
    if (!project || busy !== 'idle') return
    setBusy('deleting')
    setDeleteError('')
    try {
      await deleteAdminProject(project.id)
      dialogRef.current?.close()
      window.location.replace('/admin/projects?deleted=1')
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) window.location.replace('/admin/login')
      else setDeleteError('Suppression impossible pour le moment. Réessayez.')
    } finally {
      setBusy('idle')
    }
  }

  if (loadState === 'loading') return <p role="status">Chargement du projet…</p>
  if (loadState === 'missing') return <><h1>Projet introuvable</h1><a className="admin-text-link" href="/admin/projects">Retour aux projets</a></>
  if (loadState === 'error') return <div role="alert"><p>Impossible de charger ce projet pour le moment.</p><button className="admin-secondary-button" type="button" onClick={() => { setLoadState('loading'); setAttempt((value) => value + 1) }}>Réessayer</button></div>

  const validationEntries = Object.entries(fieldErrors)
  return <>
    <a className="admin-back-link" href="/admin/projects">← Tous les projets</a>
    <p className="admin-kicker">{editing ? 'Modifier un projet' : 'Nouveau projet'}</p>
    <h1>{editing ? (project?.title || 'Modifier le projet') : 'Créer un projet'}</h1>
    <p className="admin-lead">{editing ? 'Modifiez les informations du projet, puis enregistrez.' : 'Renseignez les informations du projet. Les images seront ajoutées séparément.'}</p>
    {feedback && <p className="admin-notice" role="status">{feedback}</p>}
    {requestError && <p className="admin-error" role="alert">{requestError}</p>}
    {!!validationEntries.length && <div className="admin-validation" role="alert" tabIndex={-1} ref={validationRef}>
      <p>Veuillez corriger les erreurs suivantes :</p>
      <ul>{validationEntries.map(([key, messages]) => <li key={key}>
        {key in labels ? <a href={`#project-${key}`}>{labels[key as TextFieldName]}</a> : key} : {messages.join(', ')}
      </li>)}</ul>
    </div>}
    <form className="admin-project-form" onSubmit={handleSubmit}>
      <fieldset disabled={busy !== 'idle'}>
        <div className="admin-form-grid">
          <ProjectField name="title" value={values.title} onChange={changeField} errors={fieldErrors.title} required />
          <ProjectField name="slug" value={values.slug} onChange={changeField} errors={fieldErrors.slug} required hint="Identifiant utilisé dans l’adresse publique du projet." />
          <ProjectField name="summary" value={values.summary} onChange={changeField} errors={fieldErrors.summary} multiline />
          <ProjectField name="description" value={values.description} onChange={changeField} errors={fieldErrors.description} multiline />
          <ProjectField name="category" value={values.category} onChange={changeField} errors={fieldErrors.category} hint="Utilisez la catégorie souhaitée, par exemple Affiches, Programmes ou Livres." />
          <ProjectField name="year" value={values.year} onChange={changeField} errors={fieldErrors.year} type="number" />
          <ProjectField name="client" value={values.client} onChange={changeField} errors={fieldErrors.client} />
        </div>
        <div className="admin-form-status">
          <label className="admin-checkbox"><input type="checkbox" checked={values.published} onChange={(event) => { setValues((current) => ({ ...current, published: event.target.checked })); setFeedback('') }} /><span><strong>Publié</strong><small>{values.published ? 'Visible dans le portfolio public.' : 'Brouillon, non visible dans le portfolio public.'}</small></span></label>
          <label className="admin-checkbox"><input type="checkbox" checked={values.featured} onChange={(event) => { setValues((current) => ({ ...current, featured: event.target.checked })); setFeedback('') }} /><span><strong>Mis en avant</strong><small>{values.featured ? 'Ce projet est marqué comme mis en avant.' : 'Ce projet n’est pas marqué comme mis en avant.'}</small></span></label>
        </div>
        <div className="admin-form-actions">
          <button className="admin-button" type="submit">{busy === 'saving' ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Créer le projet'}</button>
          <a className="admin-text-link" href="/admin/projects">Retour à la liste</a>
        </div>
      </fieldset>
    </form>
    {editing && project && <ProjectImagesSection projectId={project.id} />}
    {editing && project && <section className="admin-danger-zone" aria-labelledby="admin-delete-heading">
      <h2 id="admin-delete-heading">Suppression</h2>
      <p>Supprimer définitivement ce projet et ses données associées.</p>
      <button className="admin-danger-button" type="button" disabled={busy !== 'idle'} onClick={() => { setDeleteError(''); dialogRef.current?.showModal() }}>Supprimer le projet « {project.title} »</button>
      <dialog className="admin-delete-dialog" ref={dialogRef} onCancel={(event) => { if (busy !== 'idle') event.preventDefault() }} aria-labelledby="admin-confirm-heading" aria-describedby="admin-confirm-description">
        <h2 id="admin-confirm-heading">Supprimer « {project.title} » ?</h2>
        <p id="admin-confirm-description">Cette suppression est définitive. Les images associées seront également supprimées.</p>
        {deleteError && <p className="admin-error" role="alert">{deleteError}</p>}
        <div className="admin-dialog-actions">
          <form method="dialog"><button className="admin-secondary-button" type="submit" disabled={busy !== 'idle'}>Annuler</button></form>
          <button className="admin-danger-button" type="button" disabled={busy !== 'idle'} onClick={handleDelete}>{busy === 'deleting' ? 'Suppression…' : `Confirmer la suppression de « ${project.title} »`}</button>
        </div>
      </dialog>
    </section>}
  </>
}
