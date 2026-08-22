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

// A one-line, no-dependency "route": `/kids` mounts the standalone Kids
// Version instead of the main app. Deliberately not pulling in a routing
// library for a single static entry point — see src/kids/KidsApp.jsx's
// header comment for why the two apps are kept as separate files rather
// than one branching component. Every other path (including any the main
// app's own client-side state might produce) renders <App /> exactly as
// before.
const isKidsRoute = window.location.pathname.replace(/\/+$/, '') === '/kids';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isKidsRoute ? <KidsApp /> : <App />}
  </StrictMode>,
)
