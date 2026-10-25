import { useEffect, useSyncExternalStore } from 'react'
import { refreshSession, sessionStore } from './api'
import ActivityLog from './components/ActivityLog'
import AuthScreen from './components/AuthScreen'
import Dashboard from './components/Dashboard'

export default function App() {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot)

  // On load there is no access token in memory. Use the refresh cookie (if any)
  // to get one; if that fails, show the sign-in screen.
  useEffect(() => {
    if (session.status === 'loading') void refreshSession()
  }, [session.status])

  return (
    <div className="layout">
      <main className="main">
        {session.status === 'loading' && <p className="muted">Restoring your session…</p>}
        {session.status === 'signedOut' && <AuthScreen />}
        {session.status === 'signedIn' && <Dashboard session={session} />}
      </main>
      <ActivityLog />
    </div>
  )
}
