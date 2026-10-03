import { useEffect, useState, type FormEvent } from 'react'
import { AdminApiError, getAdminSession, logIn, logOut, type AdminUser } from './api/admin'
import { getAdminProjectId, getAdminSection, type AdminSection } from './adminRoutes'
import { ProjectFormPage } from './admin/ProjectFormPage'
import { ProjectOrderPage } from './admin/ProjectOrderPage'
import { ProjectsPage } from './admin/ProjectsPage'
import { ProfilePage } from './admin/ProfilePage'
import './styles/admin.css'

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const loginPath = path === '/admin/login'
const section = getAdminSection(path)

const adminLinks = [
  { path: '/admin', label: 'Tableau de bord', section: 'dashboard' },
  { path: '/admin/projects', label: 'Projets', section: 'projects' },
  { path: '/admin/profile', label: 'Profil', section: 'profile' },
] as const

export function AdminContent({ currentSection }: { currentSection: AdminSection }) {
  if (currentSection === 'dashboard') {
    return <section className="admin-dashboard" aria-labelledby="admin-dashboard-heading">
      <div className="admin-dashboard-intro">
        <p className="admin-kicker">Espace de travail</p>
        <h1 id="admin-dashboard-heading">Tableau de bord</h1>
        <p className="admin-lead">Bienvenue dans l’administration du portfolio de Louise. Choisissez une section pour continuer.</p>
      </div>
      <nav className="admin-shortcuts" aria-label="Accès rapides">
        <a href="/admin/projects"><span><strong>Projets</strong><small>Gérer les projets et leurs images</small></span><span aria-hidden="true">↗</span></a>
        <a href="/admin/profile"><span><strong>Profil</strong><small>Modifier les informations de Louise</small></span><span aria-hidden="true">↗</span></a>
      </nav>
    </section>
  }

  if (currentSection === 'projects') {
    return <ProjectsPage />
  }

  if (currentSection === 'project-order') {
    return <ProjectOrderPage />
  }

  if (currentSection === 'project-new') {
    return <ProjectFormPage />
  }

  if (currentSection === 'project-edit') {
    const id = getAdminProjectId(path)
    return id === null ? null : <ProjectFormPage projectId={id} />
  }

  if (currentSection === 'profile') {
    return <ProfilePage />
  }

  return <>
    <h1>Page introuvable</h1>
    <p className="admin-lead">Cette page de l’administration n’existe pas.</p>
    <a className="admin-text-link" href="/admin">Revenir au tableau de bord</a>
  </>
}

export function AdminShell({ user, currentSection, submitting, formError, onLogout }: {
  user: AdminUser
  currentSection: AdminSection
  submitting: boolean
  formError: string
  onLogout: () => void
}) {
  return <div className="admin-shell">
    <a className="admin-skip" href="#admin-content">Aller au contenu</a>
    <header className="admin-header">
      <div className="admin-header-inner">
        <div className="admin-header-top">
          <a className="admin-brand" href="/admin" aria-label="Administration — tableau de bord"><span aria-hidden="true">LH</span><span>Administration</span></a>
          <div className="admin-account">
            <span className="admin-email">{user.email_address}</span>
            <button className="admin-logout" type="button" disabled={submitting} onClick={onLogout}>{submitting ? 'Déconnexion…' : 'Se déconnecter'}</button>
          </div>
        </div>
        <nav className="admin-nav" aria-label="Navigation admin">
          {adminLinks.map((link) => <a key={link.path} href={link.path} aria-current={(currentSection === link.section || (link.section === 'projects' && (currentSection === 'project-order' || currentSection === 'project-new' || currentSection === 'project-edit'))) ? 'page' : undefined}>{link.label}</a>)}
        </nav>
      </div>
    </header>
    <main className="admin-content" id="admin-content">
      {formError && <p className="admin-error" role="alert">{formError}</p>}
      <AdminContent currentSection={currentSection} />
    </main>
  </div>
}

function AdminApp() {
  const [session, setSession] = useState<{ state: 'loading' | 'unauthenticated' | 'error' } | { state: 'authenticated'; user: AdminUser }>({ state: 'loading' })
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

  if (!loginPath && session.state === 'authenticated') {
    return <AdminShell user={session.user} currentSection={section} submitting={submitting} formError={formError} onLogout={handleLogout} />
  }

  return (
    <main className="admin-entry">
      <div className="admin-card">
        <span className="admin-mark" aria-hidden="true">LH</span>
        {session.state === 'loading' && <p className="admin-state admin-state-loading" role="status">Vérification de la session…</p>}
        {session.state === 'error' && <div className="admin-state admin-state-error" role="alert"><p>La session ne peut pas être vérifiée pour le moment.</p><button className="admin-secondary-button" type="button" onClick={() => { setSession({ state: 'loading' }); setAttempt((value) => value + 1) }}>Réessayer</button></div>}
        {loginPath && session.state === 'unauthenticated' && <>
          <p className="admin-kicker">Espace privé</p>
          <h1>Connexion admin</h1>
          <p className="admin-intro">Accès privé au portfolio de Louise.</p>
          <form onSubmit={handleLogin}>
            <label htmlFor="admin-email">Adresse e-mail</label>
            <input id="admin-email" name="email_address" type="email" autoComplete="username" required autoFocus />
            <label htmlFor="admin-password">Mot de passe</label>
            <input id="admin-password" name="password" type="password" autoComplete="current-password" required />
            {formError && <p className="admin-error admin-inline-alert" role="alert">{formError}</p>}
            <button className="admin-button" type="submit" disabled={submitting}>{submitting ? 'Connexion…' : 'Se connecter'}</button>
          </form>
        </>}
      </div>
    </main>
  )
}

export default AdminApp
