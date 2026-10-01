import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from 'react'
import {
  getProfile,
  getProject,
  getProjects,
  type Profile,
  type ProjectDetail,
  type ProjectImage,
  type ProjectSummary,
} from './api/public'
import './styles/mockup.css'
import './styles/app.css'

const categories = ['Tous', 'Affiches', 'Programmes', 'Livres'] as const
const tones = ['#dce3e7', '#e5e0d4', '#d4dfdf', '#e8e2d6', '#dce0e9', '#e2e3db']
const approvedAboutCopy = [
  'J’aime la rencontre entre un texte et une image. Trouver le rythme d’une page, faire dialoguer les couleurs, choisir la typographie qui change tout.',
  'Mon univers se construit autour du design graphique et de l’édition : de l’affiche culturelle à la couverture d’un livre, chaque format devient une nouvelle façon de raconter.',
]
const approvedContactEmail = 'louise.huguin@gmail.com'
const heroSlots = [
  { title: 'Théâtre de femmes', x: '5%', y: '12%', w: '10%', r: '-9deg', mx: '3%', my: '7%', mw: '14%' },
  { title: 'Intersections', x: '24%', y: '4%', w: '9%', r: '8deg', mx: '25%', my: '3%', mw: '14%' },
  { title: '1624-2024', x: '46%', y: '2%', w: '8%', r: '-4deg', mx: '52%', my: '5%', mw: '13%' },
  { title: 'Kafka sur le rivage', x: '68%', y: '6%', w: '8%', r: '11deg', mx: '78%', my: '6%', mw: '14%' },
  { title: 'EThAp', x: '86%', y: '14%', w: '9%', r: '8deg', mx: '84%', my: '37%', mw: '13%' },
  { title: 'Les ambassadrices', x: '15%', y: '43%', w: '9%', r: '-10deg', mx: '2%', my: '38%', mw: '13%' },
  { title: 'Game of Thrones', x: '78%', y: '42%', w: '9%', r: '-9deg', mx: '5%', my: '74%', mw: '14%' },
  { title: 'Giacomo Puccini', x: '4%', y: '68%', w: '10%', r: '7deg', mx: '29%', my: '76%', mw: '14%' },
  { title: 'La belle et la bête', x: '29%', y: '71%', w: '8%', r: '-6deg', mx: '55%', my: '75%', mw: '14%' },
  { title: 'La ville des sens', x: '70%', y: '69%', w: '9%', r: '10deg', mx: '80%', my: '72%', mw: '14%' },
]

function slugFromPath() {
  const match = window.location.pathname.match(/^\/projects\/([^/]+)\/?$/)
  if (!match) return null
  try { return decodeURIComponent(match[1]) } catch { return null }
}

function paragraphs(value: string | null | undefined) {
  return value?.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean) ?? []
}

function imageLabel(image: ProjectImage) {
  return image.caption || (image.asset_kind === 'mockup' ? 'Mise en situation' : 'Création originale')
}

function projectFormat(project: ProjectDetail) {
  if (project.category === 'Affiches') return 'Affiche'
  if (project.category === 'Livres') return 'Couverture / édition'
  if (project.category === 'Programmes') return project.images[0]?.asset_kind === 'mockup' ? 'Programme / mise en situation' : 'Programme / mise en page'
  return project.title
}

function Card({ project, index, onOpen }: { project: ProjectSummary; index: number; onOpen: (project: ProjectSummary, trigger: HTMLElement) => void }) {
  return (
    <button
      type="button"
      className="project reveal"
      style={{ '--tone': tones[index % tones.length] } as CSSProperties}
      aria-label={`Découvrir ${project.title}`}
      onClick={(event) => onOpen(project, event.currentTarget)}
    >
      <span className="frame">
        {project.primary_image ? <img src={project.primary_image.image_url} alt={project.primary_image.alt_text || project.title} loading="lazy" /> : <span className="image-missing">Image à venir</span>}
        <span className="open-label">Découvrir le projet</span>
      </span>
      <span className="project-meta"><span className="project-title">{project.title}</span><span className="project-type">{project.category}</span></span>
      {project.summary && <span className="project-sub">{project.summary}</span>}
    </button>
  )
}

function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState(false)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectsState, setProjectsState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [filter, setFilter] = useState<string>('Tous')
  const [visible, setVisible] = useState(12)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(slugFromPath)
  const [detailResult, setDetailResult] = useState<{ slug: string; detail: ProjectDetail | null; error: boolean } | null>(null)
  const [imageIndex, setImageIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const detailRef = useRef<HTMLDialogElement>(null)
  const zoomRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const touchStartRef = useRef<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getProfile(controller.signal).then(setProfile).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setProfileError(true)
    })
    getProjects(controller.signal).then((items) => {
      setProjects(items)
      setProjectsState('ready')
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setProjectsState('error')
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const onPopState = () => { setSelectedSlug(slugFromPath()); setImageIndex(0) }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!selectedSlug) return
    const controller = new AbortController()
    getProject(selectedSlug, controller.signal).then((item) => {
      setDetailResult({ slug: selectedSlug, detail: item, error: false })
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setDetailResult({ slug: selectedSlug, detail: null, error: true })
    })
    return () => controller.abort()
  }, [selectedSlug])

  useEffect(() => {
    const dialog = detailRef.current
    if (selectedSlug && dialog && !dialog.open) dialog.showModal()
    if (!selectedSlug && dialog?.open) dialog.close()
  }, [selectedSlug])

  useEffect(() => {
    const dialog = zoomRef.current
    if (zoomed && dialog && !dialog.open) dialog.showModal()
    if (!zoomed && dialog?.open) dialog.close()
  }, [zoomed])

  function navigateToProject(project: ProjectSummary, trigger?: HTMLElement) {
    if (trigger) openerRef.current = trigger
    window.history.pushState({}, '', `/projects/${encodeURIComponent(project.slug)}`)
    setImageIndex(0)
    setSelectedSlug(project.slug)
  }

  function closeDetail() {
    setZoomed(false)
    if (selectedSlug) {
      window.history.pushState({}, '', '/')
      setSelectedSlug(null)
    }
    requestAnimationFrame(() => openerRef.current?.focus({ preventScroll: true }))
  }

  function chooseFilter(category: string) {
    setFilter(category)
    setVisible(12)
  }

  const coreProjects = projects.filter((item) => item.category !== 'Explorations')
  const extras = projects.filter((item) => item.category === 'Explorations')
  const filtered = filter === 'Tous' ? coreProjects : coreProjects.filter((item) => item.category === filter)
  const displayed = filtered.slice(0, visible)
  const heroProjects: Array<ProjectSummary | null> = []
  const used = new Set<string>()
  for (const slot of heroSlots) {
    const item = coreProjects.find((project) => project.primary_image && !used.has(project.slug) && project.title.toLocaleLowerCase('fr').includes(slot.title.toLocaleLowerCase('fr')))
      ?? coreProjects.find((project) => project.primary_image && project.featured && !used.has(project.slug))
      ?? coreProjects.find((project) => project.primary_image && !used.has(project.slug))
      ?? null
    if (item) used.add(item.slug)
    heroProjects.push(item)
  }
  const currentResult = detailResult?.slug === selectedSlug ? detailResult : null
  const detail = currentResult?.detail ?? null
  const detailState = currentResult ? currentResult.error ? 'error' : 'ready' : 'loading'
  const image = detail?.images[imageIndex]
  const descriptionParts = paragraphs(detail?.description)
  const name = profile?.display_name || 'Louise Huguin'
  const [firstName, ...lastName] = name.split(/\s+/)
  const aboutCopy = profile?.bio ? paragraphs(profile.bio) : profile ? approvedAboutCopy : []
  const contactEmail = profile?.email || approvedContactEmail
  const nextList = detail?.category === 'Explorations' ? extras : filtered.length ? filtered : coreProjects

  function stepImage(direction: number) {
    if (detail) setImageIndex((current) => Math.max(0, Math.min(detail.images.length - 1, current + direction)))
  }

  function onImageTouchEnd(event: TouchEvent) {
    if (touchStartRef.current === null) return
    const delta = event.changedTouches[0].clientX - touchStartRef.current
    if (Math.abs(delta) > 55) stepImage(delta < 0 ? 1 : -1)
    touchStartRef.current = null
  }

  return (
    <>
      <a className="skip" href="#creations">Aller aux créations</a>
      <header className="topbar" id="top"><nav className="nav wrap" aria-label="Navigation principale"><a className="brand" href="/#top" aria-label="Louise Huguin, accueil">LH</a><div className="navlinks"><a href="/#a-propos">À propos</a><a href="/#creations">Créations</a><a href="/#contact">Contact</a></div></nav></header>
      <main>
        <section className="hero" aria-labelledby="intro-title"><div className="hero-canvas">
          {heroSlots.map((slot, index) => {
            const project = heroProjects[index]
            return project?.primary_image && <button key={slot.title} type="button" className="float" style={{ '--x': slot.x, '--y': slot.y, '--w': slot.w, '--r': slot.r, '--mx': slot.mx, '--my': slot.my, '--mw': slot.mw, '--duration': `${7 + index % 4}s`, '--delay': `${-index * 0.63}s` } as CSSProperties} aria-label={`Découvrir ${project.title}`} onClick={(event) => navigateToProject(project, event.currentTarget)}><img src={project.primary_image.image_url} alt="" /></button>
          })}
          <h1 className="hero-heading" id="intro-title"><span className="name">{firstName}</span><span className="surname">{lastName.join(' ')}</span><span className="profession">— Graphiste —</span></h1>
        </div></section>
        <section id="creations" className="work-section" aria-labelledby="work-title"><div className="wrap"><div className="section-head"><h2 id="work-title">Créations</h2></div><div className="filters" aria-label="Filtrer les créations">{categories.map((category) => <button type="button" className="filter" key={category} aria-pressed={filter === category} onClick={() => chooseFilter(category)}>{category === 'Tous' ? 'Tout voir' : category}</button>)}</div><p className="results" aria-live="polite">{projectsState === 'ready' ? `${displayed.length} créations affichées sur ${filtered.length}` : ''}</p>
          {projectsState === 'loading' && <p className="content-state" role="status">Chargement des créations…</p>}
          {projectsState === 'error' && <p className="content-state" role="alert">Les créations sont momentanément indisponibles. Réessayez plus tard.</p>}
          {projectsState === 'ready' && filtered.length === 0 && <p className="content-state">Aucune création publiée dans cette catégorie pour le moment.</p>}
          <div id="projects" className="grid">{displayed.map((project, index) => <Card key={project.slug} project={project} index={index} onOpen={navigateToProject} />)}</div>
          {visible < filtered.length && <div className="more-row"><button type="button" className="btn btn-outline" onClick={() => setVisible((count) => count + 12)}>Voir plus de créations</button></div>}
        </div></section>
        <section id="a-propos" className="about wrap" aria-labelledby="about-title"><div className="about-layout"><div className="about-copy"><span className="eyebrow">À propos</span><h2 id="about-title">Le goût des images,<br /><em>le sens du détail.</em></h2>{profile?.headline && <p>{profile.headline}</p>}{aboutCopy.map((part, index) => <p key={index}>{part}</p>)}{!profile && !profileError && <p role="status">Chargement du profil…</p>}{profileError && <p role="alert">Le profil est momentanément indisponible.</p>}<p className="sign">{firstName}</p></div><div className="about-photo-stage"><figure className="about-photo"><img src="/images/louise.webp" alt="Louise Huguin dans un jardin, devant un pavillon japonais" loading="lazy" width="1254" height="1254" /><figcaption>Un peu de moi, beaucoup de curiosité.</figcaption></figure></div></div><div className="aside-work"><div className="aside-heading"><h3>Et parfois, hors cadre.</h3><p>D’autres supports, la même envie de créer.</p></div>{extras.length > 0 && <div id="extras" className="grid small-grid">{extras.map((project, index) => <Card key={project.slug} project={project} index={index} onOpen={navigateToProject} />)}</div>}{projectsState === 'ready' && extras.length === 0 && <p className="content-state">D’autres créations à découvrir bientôt.</p>}</div></section>
        <section id="contact" className="contact" aria-labelledby="contact-title"><div className="wrap contact-layout"><div className="contact-heading"><span className="eyebrow">Contact</span><h2 id="contact-title">Restons<br />en contact</h2></div><div className="contact-note"><p>Une idée, un projet ou simplement quelques mots&nbsp;?</p><a className="contact-mail" href={`mailto:${contactEmail}`}>{contactEmail}<span aria-hidden="true">↗</span></a></div></div></section>
      </main>
      <footer className="footer wrap"><span>{name} · Design graphique & édition</span><span>{profile?.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer">Instagram</a>}{profile?.linkedin_url && <> · <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">LinkedIn</a></>}</span><a href="/#top">Retour en haut</a></footer>
      <dialog ref={detailRef} id="detail" aria-labelledby="detail-title" onClose={closeDetail} onKeyDown={(event) => { if (zoomed) return; if (event.key === 'ArrowRight') { event.preventDefault(); stepImage(1) } if (event.key === 'ArrowLeft') { event.preventDefault(); stepImage(-1) } }}><div className="detail-top"><span className="eyebrow">Louise Huguin / Créations</span><button type="button" className="close" onClick={closeDetail}>Fermer <b aria-hidden="true">×</b></button></div>
        {!detail && <h2 id="detail-title" className="visually-hidden">Détail de la création</h2>}
        {detailState === 'loading' && <p className="content-state" role="status">Chargement de la création…</p>}
        {detailState === 'error' && <div className="content-state" role="alert"><p>Cette création est introuvable ou momentanément indisponible.</p><button type="button" className="btn btn-outline" onClick={closeDetail}>Retour aux créations</button></div>}
        {detail && <div className="detail-layout"><div className="detail-visual">{image ? <img className="main-image" src={image.image_url} alt={image.alt_text || detail.title} tabIndex={0} role="button" aria-label={`Agrandir : ${image.alt_text || detail.title}`} onClick={() => setZoomed(true)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setZoomed(true) } }} onTouchStart={(event) => { touchStartRef.current = event.changedTouches[0].clientX }} onTouchEnd={onImageTouchEnd} /> : <p className="content-state">Aucune image pour cette création.</p>}<div className="viewer-controls"><button type="button" className="round" aria-label="Image précédente" disabled={imageIndex === 0} onClick={() => stepImage(-1)}>‹</button><span className="counter" aria-live="polite">{detail.images.length ? imageIndex + 1 : 0} / {detail.images.length}</span><button type="button" className="round" aria-label="Image suivante" disabled={imageIndex >= detail.images.length - 1} onClick={() => stepImage(1)}>›</button></div><div className="thumbs" aria-label="Images de cette création">{detail.images.map((item, index) => <button type="button" className="thumb" key={`${item.position}-${index}`} aria-label={`${imageLabel(item)}, image ${index + 1}`} aria-pressed={imageIndex === index} onClick={() => setImageIndex(index)}><img src={item.image_url} alt="" loading="lazy" /></button>)}</div>{image && <div className="image-caption">{imageLabel(image)} · Cliquer pour agrandir</div>}</div><aside className="detail-info"><span className="eyebrow">{detail.category}</span><h2 id="detail-title">{detail.title}</h2>{descriptionParts.length > 0 && <section className="detail-description" aria-label="Description"><h3>Description</h3>{descriptionParts.map((part, index) => <p key={index}>{part}</p>)}</section>}<dl><div><dt>Format</dt><dd>{projectFormat(detail)}</dd></div>{detail.summary && <div><dt>Projet</dt><dd>{detail.summary}</dd></div>}{detail.year && <div><dt>Année</dt><dd>{detail.year}</dd></div>}{detail.client && <div><dt>Client</dt><dd>{detail.client}</dd></div>}</dl>{nextList.length > 1 && <div className="next-project"><button type="button" className="btn btn-outline" onClick={() => { const index = nextList.findIndex((item) => item.slug === detail.slug); navigateToProject(nextList[(index + 1) % nextList.length]) }}>Création suivante</button></div>}</aside></div>}
      </dialog>
      <dialog ref={zoomRef} id="zoom" className="zoom" aria-label="Image agrandie" onClose={() => setZoomed(false)}><div className="zoom-bar"><button type="button" className="btn btn-outline" onClick={() => setZoomed(false)}>Fermer l’agrandissement</button></div>{image && <img className="zoom-image" src={image.image_url} alt={image.alt_text || detail?.title || ''} onClick={() => setZoomed(false)} />}</dialog>
    </>
  )
}

export default App
