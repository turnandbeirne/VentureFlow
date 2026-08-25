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
import KidsApp from './kids/KidsApp.jsx'
import RecapViewer from './components/RecapViewer.jsx'

// Same one-line, no-dependency "route" pattern for two static entry points:
// `/kids` mounts the standalone Kids Version, `/recap` mounts the read-only
// shareable-recap page a game-over "Share Link"/"Email" opens (see
// game/recapShare.js + components/RecapViewer.jsx — the actual recap data
// lives in the URL's fragment, never sent here as a path segment). Neither
// pulls in a routing library for what's a single static entry point each —
// see src/kids/KidsApp.jsx's header comment for the reasoning. Every other
// path renders <App /> exactly as before.
const path = window.location.pathname.replace(/\/+$/, '');
const isKidsRoute = path === '/kids';
const isRecapRoute = path === '/recap';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isKidsRoute ? <KidsApp /> : isRecapRoute ? <RecapViewer /> : <App />}
  </StrictMode>,
)
