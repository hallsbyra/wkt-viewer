import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import WebviewMap from './WebviewMap.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebviewMap/>
  </StrictMode>,
)
