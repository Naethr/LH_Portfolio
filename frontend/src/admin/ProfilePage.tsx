import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AdminApiError, getAdminProfile, updateAdminProfile, type AdminProfile } from '../api/admin'

type ProfileField = keyof AdminProfile
type FormValues = Record<ProfileField, string>
type FieldErrors = Record<string, string[]>

const labels: Record<ProfileField, string> = {
  display_name: 'Nom affiché',
  headline: 'Accroche',
  bio: 'Biographie',
  email: 'Adresse e-mail',
  instagram_url: 'URL Instagram',
  linkedin_url: 'URL LinkedIn',
}

const emptyValues: FormValues = {
  display_name: '', headline: '', bio: '', email: '', instagram_url: '', linkedin_url: '',
}

function valuesFromProfile(profile: AdminProfile): FormValues {
  return {
    display_name: profile.display_name,
    headline: profile.headline ?? '',
    bio: profile.bio ?? '',
    email: profile.email ?? '',
    instagram_url: profile.instagram_url ?? '',
    linkedin_url: profile.linkedin_url ?? '',
  }
}

function profileFromValues(values: FormValues): AdminProfile {
  return {
    display_name: values.display_name.trim(),
    headline: values.headline.trim() || null,
    bio: values.bio.trim() || null,
    email: values.email.trim() || null,
    instagram_url: values.instagram_url.trim() || null,
    linkedin_url: values.linkedin_url.trim() || null,
  }
}

function ProfileFieldInput({ name, value, error, onChange }: {
  name: ProfileField
  value: string
  error?: string[]
  onChange: (name: ProfileField, value: string) => void
}) {
  const id = `profile-${name}`
  const field = {
    id,
    name,
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(name, event.target.value),
    'aria-invalid': error?.length ? true : undefined,
    'aria-describedby': error?.length ? `${id}-error` : undefined,
  }

  return <div className={`admin-form-field${name === 'bio' ? ' admin-form-field-wide' : ''}`}>
    <label htmlFor={id}>{labels[name]}{name === 'display_name' && <span aria-hidden="true"> *</span>}</label>
    {name === 'bio'
      ? <textarea {...field} rows={8} />
      : <input {...field} type="text" inputMode={name === 'email' ? 'email' : name.endsWith('_url') ? 'url' : undefined} autoComplete={name === 'email' ? 'email' : undefined} placeholder={name === 'instagram_url' ? 'https://instagram.com/…' : name === 'linkedin_url' ? 'https://linkedin.com/in/…' : undefined} />}
    {!!error?.length && <p className="admin-field-error" id={`${id}-error`}>{error.join(', ')}</p>}
  </div>
}

export function ProfilePage() {
  const [values, setValues] = useState<FormValues>(emptyValues)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [requestError, setRequestError] = useState('')
  const [feedback, setFeedback] = useState('')
  const validationRef = useRef<HTMLDivElement>(null)
  const focusValidation = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    getAdminProfile(controller.signal).then((profile) => {
      if (controller.signal.aborted) return
      setValues(valuesFromProfile(profile))
      setLoadState('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      if (error instanceof AdminApiError && error.status === 401) window.location.replace('/admin/login')
      else setLoadState('error')
    })
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    if (focusValidation.current && Object.keys(fieldErrors).length) {
      validationRef.current?.focus()
      focusValidation.current = false
    }
  }, [fieldErrors])

  function changeField(name: ProfileField, value: string) {
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
    if (saving) return
    setSaving(true)
    setRequestError('')
    setFeedback('')
    setFieldErrors({})
    try {
      const profile = await updateAdminProfile(profileFromValues(values))
      setValues(valuesFromProfile(profile))
      setFeedback('Le profil a été enregistré.')
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        window.location.replace('/admin/login')
      } else if (error instanceof AdminApiError && error.status === 422 && Object.keys(error.errors).length) {
        focusValidation.current = true
        setFieldErrors(error.errors)
      } else {
        setRequestError('Enregistrement impossible pour le moment. Réessayez.')
      }
    } finally {
      setSaving(false)
    }
  }

  return <>
    <p className="admin-kicker">Informations</p>
    <h1>Profil</h1>
    <p className="admin-lead">Modifiez les informations affichées dans le portfolio, puis enregistrez.</p>
    {loadState === 'loading' && <p className="admin-state admin-state-loading" role="status">Chargement du profil…</p>}
    {loadState === 'error' && <div className="admin-state admin-state-error" role="alert"><p>Impossible de charger le profil pour le moment.</p><button className="admin-secondary-button" type="button" onClick={() => { setLoadState('loading'); setAttempt((value) => value + 1) }}>Réessayer</button></div>}
    {loadState === 'ready' && <>
      {feedback && <p className="admin-notice" role="status">{feedback}</p>}
      {requestError && <p className="admin-error admin-inline-alert" role="alert">{requestError}</p>}
      {!!Object.keys(fieldErrors).length && <div className="admin-validation" role="alert" tabIndex={-1} ref={validationRef}>
        <p>Veuillez corriger les erreurs suivantes :</p>
        <ul>{Object.entries(fieldErrors).map(([name, messages]) => <li key={name}>{name in labels ? <a href={`#profile-${name}`}>{labels[name as ProfileField]}</a> : name} : {messages.join(', ')}</li>)}</ul>
      </div>}
      <form className="admin-profile-form" onSubmit={handleSubmit} noValidate>
        <fieldset disabled={saving}>
          <section className="admin-form-section" aria-labelledby="profile-presentation-heading">
            <h2 id="profile-presentation-heading">Présentation</h2>
            <div className="admin-form-grid">
              {(['display_name', 'headline', 'bio'] as const).map((name) => <ProfileFieldInput key={name} name={name} value={values[name]} error={fieldErrors[name]} onChange={changeField} />)}
            </div>
          </section>
          <section className="admin-form-section" aria-labelledby="profile-contact-heading">
            <h2 id="profile-contact-heading">Contact et réseaux</h2>
            <p className="admin-form-section-note">Laissez un champ vide si vous ne souhaitez pas l’afficher.</p>
            <div className="admin-form-grid">
              {(['email', 'instagram_url', 'linkedin_url'] as const).map((name) => <ProfileFieldInput key={name} name={name} value={values[name]} error={fieldErrors[name]} onChange={changeField} />)}
            </div>
          </section>
          <div className="admin-form-actions">
            <button className="admin-button" type="submit">{saving ? 'Enregistrement…' : 'Enregistrer le profil'}</button>
          </div>
        </fieldset>
      </form>
    </>}
  </>
}
