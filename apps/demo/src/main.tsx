import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@org/geospatial-map/styles.css'

const App = lazy(() => import('./App.js').then((module) => ({ default: module.App })))

createRoot(document.querySelector('#root')!).render(
  <StrictMode>
    <Suspense fallback={<p role="status">Loading map component…</p>}>
      <App />
    </Suspense>
  </StrictMode>,
)
