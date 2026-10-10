// The behaviour of <demo-frame> (DemoFrame.astro): the framework and view buttons, the shield
// that keeps the map from taking the page's scrolling, and the loading state. The framework is the
// reader's, shared with the code tabs (framework-choice.ts).
import { frameworkLabels, type Framework } from './demo-url'
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
   * Shrinks the frame to its demo when the demo is shorter than the frame's height (the grid, whose
   * maps have a height of their own); a map that fills the frame keeps the frame's height. Only a
   * demo on the site's own origin can be measured.
   */
  #fit() {
    const iframe = this.#iframe
    const stage = this.querySelector<HTMLElement>('.stage')
    const doc = iframe ? documentOf(iframe) : null
    if (!iframe || !stage || !doc?.body) return
    // The body, not the root: the root is never shorter than the frame.
    const content = Math.ceil(doc.body.getBoundingClientRect().height)
    // Shorter than the frame: fit it. Taller than the frame (narrower now, so the grid has more
    // rows): back to the frame's own height. The same height, once fitted: nothing to do.
    if (content > 0 && content < iframe.clientHeight - 2) {
      stage.style.setProperty('--demo-fit', `${content}px`)
    } else if (content > iframe.clientHeight + 2) stage.style.removeProperty('--demo-fit')
  }

  #onFocusIn = (event: FocusEvent) => {
    if (event.target instanceof Node && !this.contains(event.target)) this.#arm()
  }

  /** Shows the map's frame and its links for the current view and framework. */
  #render(initial = false) {
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
    if (initial) this.#watch(true)
    else if (iframe.getAttribute('src') !== view.src[framework]) {
      iframe.setAttribute('src', view.src[framework])
      this.#watch(false)
    }

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
