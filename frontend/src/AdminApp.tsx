import { useEffect, useState, type FormEvent } from 'react'
import { AdminApiError, getAdminSession, logIn, logOut, type AdminUser } from './api/admin'
import './styles/admin.css'

const loginPath = /^\/admin\/login\/?$/.test(window.location.pathname)

function AdminApp() {
  const [session, setSession] = useState<{ state: 'loading' | 'authenticated' | 'unauthenticated' | 'error'; user?: AdminUser }>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getAdminSession(controller.signal).then((user) => {
      if (controller.signal.aborted) return
      if (loginPath) window.location.replace('/admin')
      else setSession({ state: 'authenticated', user })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      if (error instanceof AdminApiError && error.status === 401) {
        if (loginPath) setSession({ state: 'unauthenticated' })
        else window.location.replace('/admin/login')
      } else {
        setSession({ state: 'error' })
      }
    })
    return () => controller.abort()
  }, [attempt])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setFormError('')
    setSubmitting(true)
    const form = new FormData(event.currentTarget)
    try {
      await logIn(String(form.get('email_address') || '').trim(), String(form.get('password') || ''))
      window.location.replace('/admin')
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        setFormError('Adresse e-mail ou mot de passe incorrect.')
      } else if (error instanceof AdminApiError && error.status === 429) {
        setFormError('Trop de tentatives. Réessayez dans quelques minutes.')
      } else {
        setFormError('Connexion impossible pour le moment. Réessayez.')
      }
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    if (submitting) return
    setFormError('')
    setSubmitting(true)
    try {
      await logOut()
      window.location.replace('/admin/login')
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        window.location.replace('/admin/login')
        return
      }
      setFormError('Déconnexion impossible pour le moment. Réessayez.')
      setSubmitting(false)
    }
  }

  return (
    <main className="admin-page">
      <div className="admin-card">
        <span className="admin-mark" aria-hidden="true">LH</span>
        {session.state === 'loading' && <p role="status">Vérification de la session…</p>}
        {session.state === 'error' && <div role="alert"><p>La session ne peut pas être vérifiée pour le moment.</p><button className="admin-button" type="button" onClick={() => { setSession({ state: 'loading' }); setAttempt((value) => value + 1) }}>Réessayer</button></div>}
        {loginPath && session.state === 'unauthenticated' && <>
          <h1>Connexion admin</h1>
          <p className="admin-intro">Accès privé au portfolio de Louise.</p>
          <form onSubmit={handleLogin}>
            <label htmlFor="admin-email">Adresse e-mail</label>
            <input id="admin-email" name="email_address" type="email" autoComplete="username" required autoFocus />
            <label htmlFor="admin-password">Mot de passe</label>
            <input id="admin-password" name="password" type="password" autoComplete="current-password" required />
            {formError && <p className="admin-error" role="alert">{formError}</p>}
            <button className="admin-button" type="submit" disabled={submitting}>{submitting ? 'Connexion…' : 'Se connecter'}</button>
          </form>
        </>}
        {!loginPath && session.state === 'authenticated' && <>
          <h1>Espace admin</h1>
          <p className="admin-intro">Connecté avec {session.user?.email_address}.</p>
          <p>Votre session est active.</p>
          {formError && <p className="admin-error" role="alert">{formError}</p>}
          <button className="admin-button" type="button" disabled={submitting} onClick={handleLogout}>{submitting ? 'Déconnexion…' : 'Se déconnecter'}</button>
        </>}
      </div>
    </main>
  )
}

export default AdminApp
