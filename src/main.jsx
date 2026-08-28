import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/fredoka/400.css'
import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import '@fontsource/fredoka/700.css'
// Cursive "signature" style for the "by Michael P Beirne" credit line under
// the brand mark (see Brand.jsx) — only the one weight it actually uses.
import '@fontsource/dancing-script/600.css'
import './index.css'
import App from './App.jsx'
import { BUILD_ID, BUILD_NOTES } from './data/gameConfig'

// Print the build stamp to the console on boot. If a build ever *looks* like
// it is missing recent work, this is the fastest way to tell whether the page
// is actually running the newest bundle or a stale cached/deployed one.
console.info(`%cVentureFlow build ${BUILD_ID}`, 'font-weight:bold', `— ${BUILD_NOTES}`)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
