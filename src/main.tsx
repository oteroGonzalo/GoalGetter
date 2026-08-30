import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AuthGate from './AuthGate'
import { PetTestPage } from './components/PetTestPage'
import './index.css'

// Test route for the Daily Pet: /pet-test in dev, or #pet-test anywhere
// (hash form also works on static hosting without a server rewrite).
const isPetTest =
  window.location.pathname.replace(/\/+$/, '').endsWith('/pet-test') ||
  window.location.hash === '#pet-test'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isPetTest ? <PetTestPage /> : <AuthGate />}</StrictMode>,
)
