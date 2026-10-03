import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  AdminApiError,
  deleteAdminProjectImage,
  getAdminProjectImages,
  updateAdminProjectImage,
  uploadAdminProjectImage,
  type AdminAssetKind,
  type AdminProjectImage,
  type AdminProjectImageInput,
} from '../api/admin'

type ImageErrors = Record<string, string[]>
type GalleryState = { status: 'loading' | 'error' } | { status: 'ready'; images: AdminProjectImage[] }
type ImageDraft = Omit<AdminProjectImageInput, 'position'> & { position: string }
type UploadDraft = ImageDraft & { file: File | null }

const emptyUpload: UploadDraft = {
  file: null, asset_kind: 'artwork', alt_text: '', caption: '', position: '0', is_primary: false,
}
const fieldLabels: Record<string, string> = {
  image: 'Fichier', asset_kind: 'Type de visuel', alt_text: 'Texte alternatif', caption: 'Légende',
  position: 'Position', is_primary: 'Image principale',
}

function positionError(value: string): string[] | undefined {
  const position = Number(value)
  return value.trim() === '' || !Number.isSafeInteger(position) || position < 0
    ? ['Saisissez un entier positif ou zéro.'] : undefined
}

function displayErrors(errors: ImageErrors) {
  const entries = Object.entries(errors)
  if (!entries.length) return null
  return <div className="admin-validation" role="alert">
    <p>Veuillez corriger les erreurs suivantes :</p>
    <ul>{entries.map(([field, messages]) => <li key={field}>{fieldLabels[field] || field} : {messages.join(', ')}</li>)}</ul>
  </div>
}

function FieldError({ errors, field, id }: { errors: ImageErrors; field: string; id: string }) {
  return errors[field]?.length ? <p className="admin-field-error" id={id}>{errors[field].join(', ')}</p> : null
}

function validationDetail(error: unknown) {
  if (!(error instanceof AdminApiError) || error.status !== 422) return ''
  return Object.entries(error.errors).map(([field, messages]) => `${fieldLabels[field] || field} : ${messages.join(', ')}`).join(' ; ')
}

async function makePrimary(projectId: number, imageId: number, images: AdminProjectImage[]) {
  const previous = images.find((image) => image.is_primary && image.id !== imageId)
  if (previous) await updateAdminProjectImage(projectId, previous.id, { is_primary: false })
  try {
    await updateAdminProjectImage(projectId, imageId, { is_primary: true })
  } catch (error) {
    if (previous) {
      try { await updateAdminProjectImage(projectId, previous.id, { is_primary: true }) } catch { /* Reload reveals the saved state. */ }
    }
    throw error
  }
}

export function ProjectImagesSection({ projectId }: { projectId: number }) {
  const [gallery, setGallery] = useState<GalleryState>({ status: 'loading' })
  const [reload, setReload] = useState(0)
  const [drafts, setDrafts] = useState<Record<number, ImageDraft>>({})
  const [upload, setUpload] = useState<UploadDraft>(emptyUpload)
  const [uploadErrors, setUploadErrors] = useState<ImageErrors>({})
  const [rowErrors, setRowErrors] = useState<Record<number, ImageErrors>>({})
  const [feedback, setFeedback] = useState('')
  const [operationError, setOperationError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmImageId, setConfirmImageId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    getAdminProjectImages(projectId, controller.signal).then((images) => {
      if (controller.signal.aborted) return
      setGallery({ status: 'ready', images })
      setDrafts(Object.fromEntries(images.map((image) => [image.id, {
        asset_kind: image.asset_kind,
        alt_text: image.alt_text,
        caption: image.caption ?? '',
        position: String(image.position),
        is_primary: image.is_primary,
      }])))
      setUpload((current) => current.file ? current : {
        ...current,
        position: String(Math.max(-1, ...images.map((image) => image.position)) + 1),
      })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      if (error instanceof AdminApiError && error.status === 401) window.location.replace('/admin/login')
      else setGallery({ status: 'error' })
    })
    return () => controller.abort()
  }, [projectId, reload])

  useEffect(() => {
    if (confirmImageId !== null) dialogRef.current?.showModal()
  }, [confirmImageId])

  function refresh() {
    setGallery({ status: 'loading' })
    setRowErrors({})
    setReload((value) => value + 1)
  }

  function handleUnauthorized(error: unknown) {
    if (error instanceof AdminApiError && error.status === 401) {
      window.location.replace('/admin/login')
      return true
    }
    return false
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || gallery.status !== 'ready') return
    setFeedback('')
    setOperationError('')
    const errors: ImageErrors = {}
    if (!upload.file) errors.image = ['Choisissez un fichier JPEG, PNG ou WebP.']
    if (!upload.alt_text.trim()) errors.alt_text = ['Décrivez cette image.']
    const invalidPosition = positionError(upload.position)
    if (invalidPosition) errors.position = invalidPosition
    if (Object.keys(errors).length) { setUploadErrors(errors); return }
    setUploadErrors({})
    setBusy('upload')
    let created = false
    try {
      const hasPrimary = gallery.images.some((image) => image.is_primary)
      const image = await uploadAdminProjectImage(projectId, upload.file!, {
        asset_kind: upload.asset_kind,
        alt_text: upload.alt_text.trim(),
        caption: upload.caption.trim(),
        position: Number(upload.position),
        is_primary: upload.is_primary && !hasPrimary,
      })
      created = true
      if (upload.is_primary && hasPrimary) await makePrimary(projectId, image.id, gallery.images)
      setFeedback('L’image a été ajoutée au projet.')
      setUpload(emptyUpload)
      if (fileRef.current) fileRef.current.value = ''
      refresh()
    } catch (error) {
      if (!handleUnauthorized(error)) {
        if (created) {
          const detail = validationDetail(error)
          setOperationError(`L’image a été ajoutée, mais elle n’a pas pu devenir principale.${detail ? ` ${detail}.` : ''} Vérifiez la galerie et réessayez.`)
          refresh()
        } else if (error instanceof AdminApiError && error.status === 422 && Object.keys(error.errors).length) {
          setUploadErrors(error.errors)
        } else {
          setOperationError('Import impossible pour le moment. Réessayez.')
        }
      }
    } finally {
      setBusy(null)
    }
  }

  function changeDraft(id: number, field: keyof ImageDraft, value: string | boolean) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }))
    setRowErrors((current) => {
      if (!current[id]?.[field]) return current
      return { ...current, [id]: { ...current[id], [field]: [] } }
    })
    setFeedback('')
  }

  async function handleSave(event: FormEvent<HTMLFormElement>, image: AdminProjectImage) {
    event.preventDefault()
    if (busy || gallery.status !== 'ready') return
    const draft = drafts[image.id]
    const errors: ImageErrors = {}
    if (!draft.alt_text.trim()) errors.alt_text = ['Décrivez cette image.']
    const invalidPosition = positionError(draft.position)
    if (invalidPosition) errors.position = invalidPosition
    if (Object.keys(errors).length) {
      setRowErrors((current) => ({ ...current, [image.id]: errors }))
      return
    }
    setRowErrors((current) => ({ ...current, [image.id]: {} }))
    setOperationError('')
    setFeedback('')
    setBusy(`save-${image.id}`)
    let savedMetadata = false
    try {
      const switching = draft.is_primary && !image.is_primary && gallery.images.some((other) => other.is_primary)
      await updateAdminProjectImage(projectId, image.id, {
        asset_kind: draft.asset_kind,
        alt_text: draft.alt_text.trim(),
        caption: draft.caption.trim(),
        position: Number(draft.position),
        is_primary: switching ? false : draft.is_primary,
      })
      savedMetadata = true
      if (switching) await makePrimary(projectId, image.id, gallery.images)
      setFeedback('Les informations de l’image ont été enregistrées.')
      refresh()
    } catch (error) {
      if (!handleUnauthorized(error)) {
        if (savedMetadata) {
          const detail = validationDetail(error)
          setOperationError(`Les métadonnées ont été enregistrées, mais le changement d’image principale a échoué.${detail ? ` ${detail}.` : ''} Vérifiez la galerie.`)
          refresh()
        } else if (error instanceof AdminApiError && error.status === 422 && Object.keys(error.errors).length) {
          setRowErrors((current) => ({ ...current, [image.id]: error.errors }))
        } else {
          setRowErrors((current) => ({ ...current, [image.id]: { base: ['Enregistrement impossible pour le moment. Réessayez.'] } }))
        }
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete() {
    if (busy || gallery.status !== 'ready' || confirmImageId === null) return
    setBusy(`delete-${confirmImageId}`)
    setDeleteError('')
    try {
      await deleteAdminProjectImage(projectId, confirmImageId)
      dialogRef.current?.close()
      setConfirmImageId(null)
      setFeedback('L’image a été supprimée du projet.')
      refresh()
    } catch (error) {
      if (!handleUnauthorized(error)) setDeleteError('Suppression impossible pour le moment. Réessayez.')
    } finally {
      setBusy(null)
    }
  }

  const images = gallery.status === 'ready' ? gallery.images : []
  const confirmedImage = images.find((image) => image.id === confirmImageId)

  return <section className="admin-images-section" aria-labelledby="admin-images-heading">
    <h2 id="admin-images-heading">Images du projet</h2>
    <p>Les visuels sont affichés dans l’ordre de leur position enregistrée.</p>
    {feedback && <p className="admin-notice" role="status">{feedback}</p>}
    {operationError && <p className="admin-error admin-inline-alert" role="alert">{operationError}</p>}
    {gallery.status === 'loading' && <p className="admin-state admin-state-loading" role="status">Chargement des images…</p>}
    {gallery.status === 'error' && <div className="admin-state admin-state-error" role="alert"><p>Impossible de charger les images.</p><button className="admin-secondary-button" type="button" onClick={refresh}>Réessayer</button></div>}
    {gallery.status === 'ready' && <>
      {images.length === 0 ? <p className="admin-state admin-state-empty">Ce projet ne contient encore aucune image.</p> :
        <ol className="admin-image-list">
          {images.map((image, index) => {
            const draft = drafts[image.id]
            const errors = rowErrors[image.id] || {}
            return <li className="admin-image-card" key={image.id}>
              <div className="admin-image-preview">
                <img src={image.image_url} alt={image.alt_text} loading="lazy" />
              </div>
              <div className="admin-image-details">
                <div className="admin-image-heading">
                  <h3>Image {index + 1}</h3>
                  {image.is_primary && <span className="admin-status admin-status-published">Image principale</span>}
                </div>
                <p className="admin-image-meta"><span className="admin-image-kind">{image.asset_kind === 'artwork' ? 'Création finale · artwork' : 'Mise en situation · mockup'}</span><span>Position {image.position}</span></p>
                  <p className="admin-image-saved">Texte alternatif : {image.alt_text}</p>
                  {image.caption && <p className="admin-image-saved">Légende : {image.caption}</p>}
                  <form className="admin-image-form" onSubmit={(event) => handleSave(event, image)}>
                    <h4>Modifier les informations</h4>
                    <fieldset disabled={busy !== null}>
                      {displayErrors(errors)}
                      <div className="admin-image-fields">
                        <div className="admin-form-field"><label htmlFor={`image-kind-${image.id}`}>Type de visuel</label><select id={`image-kind-${image.id}`} value={draft.asset_kind} aria-invalid={!!errors.asset_kind?.length} aria-describedby={errors.asset_kind?.length ? `image-kind-error-${image.id}` : undefined} onChange={(event) => changeDraft(image.id, 'asset_kind', event.target.value as AdminAssetKind)}><option value="artwork">Création finale (artwork)</option><option value="mockup">Mise en situation (mockup)</option></select><FieldError errors={errors} field="asset_kind" id={`image-kind-error-${image.id}`} /></div>
                        <div className="admin-form-field"><label htmlFor={`image-position-${image.id}`}>Position</label><input id={`image-position-${image.id}`} type="number" min="0" step="1" value={draft.position} aria-invalid={!!errors.position?.length} aria-describedby={errors.position?.length ? `image-position-error-${image.id}` : undefined} onChange={(event) => changeDraft(image.id, 'position', event.target.value)} /><FieldError errors={errors} field="position" id={`image-position-error-${image.id}`} /></div>
                        <div className="admin-form-field admin-form-field-wide"><label htmlFor={`image-alt-${image.id}`}>Texte alternatif *</label><input id={`image-alt-${image.id}`} value={draft.alt_text} required aria-invalid={!!errors.alt_text?.length} aria-describedby={`image-alt-hint-${image.id}${errors.alt_text?.length ? ` image-alt-error-${image.id}` : ''}`} onChange={(event) => changeDraft(image.id, 'alt_text', event.target.value)} /><p className="admin-field-hint" id={`image-alt-hint-${image.id}`}>Décrit l’image pour l’accessibilité.</p><FieldError errors={errors} field="alt_text" id={`image-alt-error-${image.id}`} /></div>
                        <div className="admin-form-field admin-form-field-wide"><label htmlFor={`image-caption-${image.id}`}>Légende (facultative)</label><input id={`image-caption-${image.id}`} value={draft.caption} aria-invalid={!!errors.caption?.length} aria-describedby={errors.caption?.length ? `image-caption-error-${image.id}` : undefined} onChange={(event) => changeDraft(image.id, 'caption', event.target.value)} /><FieldError errors={errors} field="caption" id={`image-caption-error-${image.id}`} /></div>
                      </div>
                      <label className="admin-checkbox"><input type="checkbox" checked={draft.is_primary} aria-invalid={!!errors.is_primary?.length} aria-describedby={errors.is_primary?.length ? `image-primary-error-${image.id}` : undefined} onChange={(event) => changeDraft(image.id, 'is_primary', event.target.checked)} /><span><strong>Image principale</strong><small>Une seule image principale par projet.</small></span></label>
                      <FieldError errors={errors} field="is_primary" id={`image-primary-error-${image.id}`} />
                      <div className="admin-image-actions"><button className="admin-button" type="submit">{busy === `save-${image.id}` ? 'Enregistrement…' : 'Enregistrer cette image'}</button></div>
                    </fieldset>
                  </form>
                <button className="admin-danger-button admin-image-delete-button" type="button" disabled={busy !== null} onClick={() => { setDeleteError(''); setConfirmImageId(image.id) }}>Supprimer cette image</button>
              </div>
            </li>
          })}
        </ol>}
      <div className="admin-image-upload">
        <h3>Ajouter une image</h3>
        <p>Formats acceptés : JPEG, PNG ou WebP. Taille maximale : 15 Mo.</p>
        {displayErrors(uploadErrors)}
        <form onSubmit={handleUpload}>
          <fieldset disabled={busy !== null}>
            <div className="admin-image-fields">
              <div className="admin-form-field admin-form-field-wide"><label htmlFor="upload-image">Fichier *</label><input id="upload-image" ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" required aria-invalid={!!uploadErrors.image?.length} aria-describedby={uploadErrors.image?.length ? 'upload-image-error' : undefined} onChange={(event) => setUpload((current) => ({ ...current, file: event.target.files?.[0] || null }))} /><FieldError errors={uploadErrors} field="image" id="upload-image-error" /></div>
              <div className="admin-form-field"><label htmlFor="upload-kind">Type de visuel</label><select id="upload-kind" value={upload.asset_kind} aria-invalid={!!uploadErrors.asset_kind?.length} aria-describedby={uploadErrors.asset_kind?.length ? 'upload-kind-error' : undefined} onChange={(event) => setUpload((current) => ({ ...current, asset_kind: event.target.value as AdminAssetKind }))}><option value="artwork">Création finale (artwork)</option><option value="mockup">Mise en situation (mockup)</option></select><FieldError errors={uploadErrors} field="asset_kind" id="upload-kind-error" /></div>
              <div className="admin-form-field"><label htmlFor="upload-position">Position</label><input id="upload-position" type="number" min="0" step="1" value={upload.position} required aria-invalid={!!uploadErrors.position?.length} aria-describedby={uploadErrors.position?.length ? 'upload-position-error' : undefined} onChange={(event) => setUpload((current) => ({ ...current, position: event.target.value }))} /><FieldError errors={uploadErrors} field="position" id="upload-position-error" /></div>
              <div className="admin-form-field admin-form-field-wide"><label htmlFor="upload-alt">Texte alternatif *</label><input id="upload-alt" value={upload.alt_text} required aria-invalid={!!uploadErrors.alt_text?.length} aria-describedby={`upload-alt-hint${uploadErrors.alt_text?.length ? ' upload-alt-error' : ''}`} onChange={(event) => setUpload((current) => ({ ...current, alt_text: event.target.value }))} /><p className="admin-field-hint" id="upload-alt-hint">Décrit l’image pour l’accessibilité.</p><FieldError errors={uploadErrors} field="alt_text" id="upload-alt-error" /></div>
              <div className="admin-form-field admin-form-field-wide"><label htmlFor="upload-caption">Légende (facultative)</label><input id="upload-caption" value={upload.caption} aria-invalid={!!uploadErrors.caption?.length} aria-describedby={uploadErrors.caption?.length ? 'upload-caption-error' : undefined} onChange={(event) => setUpload((current) => ({ ...current, caption: event.target.value }))} /><FieldError errors={uploadErrors} field="caption" id="upload-caption-error" /></div>
            </div>
            <label className="admin-checkbox"><input type="checkbox" checked={upload.is_primary} aria-invalid={!!uploadErrors.is_primary?.length} aria-describedby={uploadErrors.is_primary?.length ? 'upload-primary-error' : undefined} onChange={(event) => setUpload((current) => ({ ...current, is_primary: event.target.checked }))} /><span><strong>Image principale</strong><small>Une seule image principale par projet.</small></span></label>
            <FieldError errors={uploadErrors} field="is_primary" id="upload-primary-error" />
            <button className="admin-button" type="submit">{busy === 'upload' ? 'Import en cours…' : 'Ajouter l’image'}</button>
          </fieldset>
        </form>
      </div>
    </>}
    <dialog className="admin-delete-dialog" ref={dialogRef} aria-labelledby="admin-image-delete-heading" aria-describedby="admin-image-delete-description" onClose={() => setConfirmImageId(null)} onCancel={(event) => { if (busy) event.preventDefault() }}>
      <h2 id="admin-image-delete-heading">Supprimer cette image ?</h2>
      <p id="admin-image-delete-description">{confirmedImage ? `L’image ${images.findIndex((image) => image.id === confirmedImage.id) + 1}, « ${confirmedImage.alt_text || `n° ${confirmedImage.id}`} », sera supprimée définitivement du projet.` : ''}</p>
      {deleteError && <p className="admin-error admin-inline-alert" role="alert">{deleteError}</p>}
      <div className="admin-dialog-actions"><form method="dialog"><button className="admin-secondary-button" type="submit" disabled={busy !== null}>Annuler</button></form><button className="admin-danger-button" type="button" disabled={busy !== null} onClick={handleDelete}>{busy?.startsWith('delete-') ? 'Suppression…' : 'Confirmer la suppression'}</button></div>
    </dialog>
  </section>
}
