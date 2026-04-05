import React from 'react'
import ReactDOM from 'react-dom/client'
import './theme.css'
import App from './App.jsx'
import useDailyStore from './store/useDailyStore'
import { setupSupabaseSync } from './lib/supabaseSync'

// Initialize Supabase sync after store is ready
setupSupabaseSync(useDailyStore);

// Apply saved theme on load
const savedDark = useDailyStore.getState().darkMode;
if (savedDark) document.documentElement.setAttribute("data-theme", "dark");

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
