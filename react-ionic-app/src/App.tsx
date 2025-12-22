import React, { useEffect } from 'react'
import { IonApp } from '@ionic/react'
import AppRouter from './router/AppRouter'
import { useAuthStore } from './stores/authStore'

const App: React.FC = () => {
  const initialize = useAuthStore(state => state.initialize)

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
