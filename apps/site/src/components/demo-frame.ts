// The behaviour of <demo-frame> (DemoFrame.astro): the framework and view buttons, the shield
// that keeps the map from taking the page's scrolling, and the loading state. The framework is the
// reader's, shared with the code tabs (framework-choice.ts).
import { frameworkIds, frameworkLabels, type Framework } from './demo-url'
import { pickFramework, subscribe } from './framework-choice'

interface ViewData {
  label: string
  title: string
  src: Record<Framework, string>
  full: Record<Framework, string>
}

/** How long the pointer may leave a frame before the shield comes back, in milliseconds. */
const shieldDelay = 1200
/** Give up waiting for the map to report `data-status` after this long. */
const readyTimeout = 15000
/** The tallest a frame grows to fit a demo taller than its height (the grid in one column). */
const maxFit = 2400

/** The frame's document, or null when the demo is on another origin (the demos' dev servers). */
function documentOf(iframe: HTMLIFrameElement): Document | null {
  try {
    return iframe.contentDocument
  } catch {
    return null
  }
}

/**
 * Whether every map in the demo has finished loading (`data-status` is `ready` or `error`), false
 * while one is still loading or none is there yet, undefined when the document can't be read.
 */
function mapsSettled(doc: Document): boolean | undefined {
  try {
    const maps = [...doc.querySelectorAll<HTMLElement>('[data-slot="map"]')]
    return maps.length > 0 && maps.every((map) => map.dataset.status !== 'loading')
  } catch {
    return undefined
  }
}

class DemoFrameElement extends HTMLElement {
  #views: ViewData[] = []
  #view = 0
  #framework: Framework = 'react'
  #iframe: HTMLIFrameElement | null = null
  /** Whether the frame has loaded a page, so a new view replaces that page in its history. */
  #loaded = false
  /** The URL the frame was last sent to. */
  #current = ''
  #loads = 0
  #timer: ReturnType<typeof setTimeout> | undefined
  #observer: IntersectionObserver | undefined
  #unsubscribe: (() => void) | undefined

  connectedCallback() {
    this.#iframe = this.querySelector('iframe')
    try {
      this.#views = JSON.parse(this.dataset.views ?? '[]') as ViewData[]
    } catch {
      this.#views = []
    }
    this.#framework = this.dataset.framework === 'angular' ? 'angular' : 'react'
    this.#unsubscribe = subscribe((framework) => {
      this.framework = framework
    })

    for (const button of this.querySelectorAll<HTMLButtonElement>('[data-framework-option]')) {
      button.addEventListener('click', () => {
        const framework = button.dataset.frameworkOption === 'angular' ? 'angular' : 'react'
        pickFramework(framework, button)
      })
    }
    for (const button of this.querySelectorAll<HTMLButtonElement>('[data-view-index]')) {
      button.addEventListener('click', () => {
        this.#view = Number(button.dataset.viewIndex) || 0
        this.#render()
      })
    }

    const stage = this.querySelector<HTMLElement>('.stage')
    this.querySelector('[data-shield]')?.addEventListener('click', () => this.#activate())
    stage?.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'mouse') return
      clearTimeout(this.#timer)
      this.#timer = setTimeout(() => this.#arm(), shieldDelay)
    })
    stage?.addEventListener('pointerenter', () => clearTimeout(this.#timer))
    document.addEventListener('focusin', this.#onFocusIn)
    this.#observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => !entry.isIntersecting)) this.#arm()
    })
    this.#observer.observe(this)
    window.addEventListener('resize', this.#onResize)
    this.#iframe?.addEventListener('load', () => this.#onLoad())
    // The frame can finish loading before this script runs.
    const doc = this.#iframe ? documentOf(this.#iframe) : null
    if (doc && doc.readyState === 'complete' && doc.URL !== 'about:blank') this.#loaded = true

    this.#arm(true)
    this.#render(true)
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.#onResize)
    this.#unsubscribe?.()
    document.removeEventListener('focusin', this.#onFocusIn)
    this.#observer?.disconnect()
    clearTimeout(this.#timer)
  }

  set framework(framework: Framework) {
    if (framework === this.#framework) return
    this.#framework = framework
    this.#render()
  }

  #resizing = 0

  #onResize = () => {
    cancelAnimationFrame(this.#resizing)
    this.#resizing = requestAnimationFrame(() => this.#fit())
  }

  /**
   * Fits the frame to its demo when the demo has a height of its own (the grid, whose maps are a
   * fixed height, or a whole demo with its forms): shorter, or taller up to `maxFit`, so its maps
   * don't hide behind a scroll inside the frame. A map that fills the frame is always the frame's
   * height, so it keeps it. Only a demo on the site's own origin can be measured.
   */
  #fit() {
    const iframe = this.#iframe
    const stage = this.querySelector<HTMLElement>('.stage')
    const doc = iframe ? documentOf(iframe) : null
    if (!iframe || !stage || !doc?.body) return
    // The body, not the root: the root is never shorter than the frame.
    const content = Math.min(Math.ceil(doc.body.getBoundingClientRect().height), maxFit)
    if (content > 0 && Math.abs(content - iframe.clientHeight) > 2) {
      stage.style.setProperty('--demo-fit', `${content}px`)
    }
  }

  /**
   * After each page the frame loads: when the reader followed a link inside it (the whole demo's
   * "Angular version"), the switch, the title and the links follow the framework it now shows.
   */
  #onLoad() {
    this.#loaded = true
    const doc = this.#iframe ? documentOf(this.#iframe) : null
    if (!doc || doc.URL === 'about:blank') return
    const shown = frameworkIds.find((id) => doc.location.pathname.includes(`/demo/${id}/`))
    if (!shown || shown === this.#framework) return
    this.#framework = shown
    this.#current = doc.location.href
    this.#show()
  }

  #onFocusIn = (event: FocusEvent) => {
    if (event.target instanceof Node && !this.contains(event.target)) this.#arm()
  }

  /** Shows the current view in the current framework: the buttons, the title, the frame's page. */
  #render(initial = false) {
    const view = this.#views[this.#view]
    const iframe = this.#iframe
    if (!view || !iframe) return
    this.#show()
    const url = view.src[this.#framework]
    if (initial) {
      // The page's inline script has already pointed the frame at the reader's framework.
      this.#current = iframe.getAttribute('src') ?? url
      this.#watch(true)
    } else if (url !== this.#current) {
      this.#current = url
      this.#navigate(url)
      this.#watch(false)
    }
  }

  /**
   * Sends the frame to another page. Once it has loaded one, the new page replaces it, so
   * switching views adds no entries to the browser's history (Back leaves the page, as readers
   * expect); `location.replace` is allowed on another origin's frame too (the dev servers).
   */
  #navigate(url: string) {
    const frame = this.#loaded ? this.#iframe?.contentWindow : null
    if (frame) {
      try {
        frame.location.replace(new URL(url, document.baseURI).href)
        return
      } catch {
        // Fall back to the attribute, which adds a history entry.
      }
    }
    this.#iframe?.setAttribute('src', url)
  }

  /** The buttons' pressed state, the frame's title and the links, for the view and framework. */
  #show() {
    const view = this.#views[this.#view]
    const iframe = this.#iframe
    if (!view || !iframe) return
    const framework = this.#framework
    const other: Framework = framework === 'react' ? 'angular' : 'react'
    this.dataset.framework = framework

    for (const button of this.querySelectorAll<HTMLElement>('[data-framework-option]')) {
      button.setAttribute('aria-pressed', String(button.dataset.frameworkOption === framework))
    }
    for (const button of this.querySelectorAll<HTMLElement>('[data-view-index]')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.viewIndex) === this.#view))
    }

    iframe.title = `${view.title}, ${frameworkLabels[framework]} demo`

    const full = this.querySelector<HTMLAnchorElement>('[data-link="full"]')
    const counterpart = this.querySelector<HTMLAnchorElement>('[data-link="other"]')
    if (full) full.href = view.full[framework]
    if (counterpart) {
      counterpart.href = view.full[other]
      const text = counterpart.querySelector('[data-text]')
      if (text) text.textContent = `${frameworkLabels[other]} version`
    }
  }

  /**
   * Shows the loading state until the frame has loaded and, when the demo is on the site's own
   * origin, until its maps report `data-status` other than `loading`. (The demos' dev servers are
   * another origin: there, the load event is all a page can see.)
   */
  #watch(initial: boolean) {
    const iframe = this.#iframe
    if (!iframe) return
    const load = ++this.#loads
    this.setAttribute('data-loading', '')
    const finish = () => {
      if (load !== this.#loads) return
      this.removeAttribute('data-loading')
      this.#fit()
      // Fonts and late layout can still change the demo's height.
      setTimeout(() => this.#fit(), 1000)
    }
    const settle = () => {
      const doc = documentOf(iframe)
      if (!doc) return finish()
      const started = Date.now()
      const check = () => {
        if (load !== this.#loads) return
        if (mapsSettled(doc) !== false || Date.now() - started > readyTimeout) finish()
        else setTimeout(check, 120)
      }
      check()
    }
    iframe.addEventListener('load', settle, { once: true })
    if (initial) {
      // The frame can finish loading before this script runs.
      const doc = documentOf(iframe)
      if (doc && doc.readyState === 'complete' && doc.URL !== 'about:blank') settle()
    }
  }

  /** Removes the shield and moves focus into the map. */
  #activate() {
    clearTimeout(this.#timer)
    this.removeAttribute('data-shielded')
    this.#iframe?.removeAttribute('tabindex')
    this.#iframe?.focus()
  }

  /** Puts the shield back over the map (keyboard users reach the map through it). */
  #arm(initial = false) {
    if (!initial && this.hasAttribute('data-shielded')) return
    this.setAttribute('data-shielded', '')
    this.#iframe?.setAttribute('tabindex', '-1')
  }
}

if (!customElements.get('demo-frame')) customElements.define('demo-frame', DemoFrameElement)
