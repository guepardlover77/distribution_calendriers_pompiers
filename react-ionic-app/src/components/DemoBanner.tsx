import React from 'react'
import { IonIcon, IonButton } from '@ionic/react'
import { eyeOutline, closeOutline } from 'ionicons/icons'
import { useHistory } from 'react-router-dom'
import { useDemoStore } from '@/stores/demoStore'
import { useAuthStore } from '@/stores/authStore'
import './DemoBanner.css'

const DemoBanner: React.FC = () => {
  const history = useHistory()
  const isDemoMode = useDemoStore(state => state.isDemoMode)
  const logout = useAuthStore(state => state.logout)

  if (!isDemoMode) return null

  const handleExitDemo = async () => {
    await logout()
    history.push('/login')
  }

  return (
    <div className="demo-banner">
      <div className="demo-banner-content">
        <IonIcon icon={eyeOutline} className="demo-banner-icon" />
        <span className="demo-banner-text">
          MODE DEMO - Les donnees ne sont pas enregistrees
        </span>
      </div>
      <IonButton
        size="small"
        fill="clear"
        color="light"
        onClick={handleExitDemo}
        className="demo-banner-button"
      >
        Quitter
        <IonIcon slot="end" icon={closeOutline} />
      </IonButton>
    </div>
  )
}

export default DemoBanner
