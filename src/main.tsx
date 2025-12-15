import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import GrammarWindow from './windows/GrammarWindow.tsx'

const urlParams = new URLSearchParams(window.location.search)
const isGrammarWindow = urlParams.get('window') === 'grammar'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isGrammarWindow ? <GrammarWindow /> : <App />}
  </StrictMode>,
)
