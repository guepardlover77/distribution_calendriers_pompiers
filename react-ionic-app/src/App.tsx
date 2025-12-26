import React, { useEffect } from 'react'
import { IonApp } from '@ionic/react'
import AppRouter from './router/AppRouter'
import { useAuthStore } from './stores/authStore'
import { useGeolocationPermission } from './hooks/useGeolocationPermission'
import { useDemoStore } from './stores/demoStore'
import DemoBanner from './components/DemoBanner'

const App: React.FC = () => {
  const initialize = useAuthStore(state => state.initialize)
  const isDemoMode = useDemoStore(state => state.isDemoMode)
  // Demander la permission de géolocalisation dès le démarrage de l'app
  useGeolocationPermission()

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <IonApp className={isDemoMode ? 'demo-mode-active' : ''}>
      <DemoBanner />
      <AppRouter />
    </IonApp>
  )
}

export default App
