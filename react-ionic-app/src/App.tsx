import React, { useEffect } from 'react'
import { IonApp } from '@ionic/react'
import AppRouter from './router/AppRouter'
import { useAuthStore } from './stores/authStore'
import { useGeolocationPermission } from './hooks/useGeolocationPermission'

const App: React.FC = () => {
  const initialize = useAuthStore(state => state.initialize)
  // Demander la permission de géolocalisation dès le démarrage de l'app
  useGeolocationPermission()

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <IonApp>
      <AppRouter />
    </IonApp>
  )
}

export default App
