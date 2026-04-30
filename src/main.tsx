import React from 'react'
import ReactDOM from 'react-dom/client'
import './theme.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import LoginGate from './components/LoginGate'
import { inject } from '@vercel/analytics'
import useDailyStore from './store/useDailyStore'
import { setupSupabaseSync } from './lib/supabaseSync'
import { initSentry, reportError } from './lib/sentry'

// Vercel Analytics
inject();

// Sentry error tracking. No-ops when VITE_SENTRY_DSN is not configured,
// so adding the env var in Vercel turns telemetry on without code changes.
initSentry();

// Initialize Supabase sync after store is ready
setupSupabaseSync(useDailyStore);

// Apply saved theme on load (read directly from localStorage for instant apply)
if (localStorage.getItem("ls-dark-mode") === "1") {
  document.documentElement.setAttribute("data-theme", "dark");
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary onError={(err) => reportError(err)}>
      <LoginGate>
        <App />
      </LoginGate>
    </ErrorBoundary>
  </React.StrictMode>,
)
