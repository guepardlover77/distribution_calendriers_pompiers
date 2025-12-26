import React, { useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useHistory } from 'react-router-dom'
import { IonIcon } from '@ionic/react'
import { eyeOutline, exitOutline } from 'ionicons/icons'

const DemoOverlay: React.FC = () => {
  const isDemoMode = useAuthStore(state => state.isDemoMode)
  const logout = useAuthStore(state => state.logout)
  const history = useHistory()

  const handleExitDemo = useCallback(async () => {
    await logout()
    history.push('/login')
  }, [logout, history])

  if (!isDemoMode) {
    return null
  }

  return (
    <>
      {/* Bandeau demo en haut */}
      <div
        className="demo-banner"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
          color: 'white',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          fontSize: '14px',
          fontWeight: 500
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IonIcon icon={eyeOutline} style={{ fontSize: '18px' }} />
          <span>Mode demo</span>
        </div>
        <button
          className="demo-exit-btn"
          onClick={handleExitDemo}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 12px',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 500
          }}
        >
          <IonIcon icon={exitOutline} style={{ fontSize: '16px' }} />
          Quitter
        </button>
      </div>

      {/* Style pour decaler le contenu sous le bandeau */}
      <style>{`
        .demo-mode ion-router-outlet,
        .demo-mode ion-tabs {
          top: 40px !important;
        }
        .demo-mode ion-header {
          top: 40px !important;
        }
        .demo-mode ion-content {
          --offset-top: 40px !important;
        }
      `}</style>
    </>
  )
}

export default DemoOverlay
