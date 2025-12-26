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

  // Intercepter tous les clics en mode demo
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    // Permettre le clic sur le bouton "Quitter"
    const target = e.target as HTMLElement
    if (target.closest('.demo-exit-btn') || target.closest('.demo-banner')) {
      return
    }

    // Permettre la navigation (tabs, liens, etc.)
    const isNavigationElement =
      target.closest('ion-tab-button') ||
      target.closest('ion-back-button') ||
      target.closest('[routerLink]') ||
      target.closest('a[href]')

    if (isNavigationElement) {
      return
    }

    // Permettre les interactions avec la carte (zoom, pan)
    const isMapInteraction = target.closest('.leaflet-container')
    if (isMapInteraction) {
      // Bloquer seulement les popups et marqueurs
      const isMarkerOrPopup =
        target.closest('.leaflet-marker-icon') ||
        target.closest('.leaflet-popup') ||
        target.closest('.custom-marker')

      if (!isMarkerOrPopup) {
        return
      }
    }

    // Bloquer tous les autres clics sur les elements interactifs
    const isInteractiveElement =
      target.closest('ion-button') ||
      target.closest('ion-fab-button') ||
      target.closest('ion-input') ||
      target.closest('ion-select') ||
      target.closest('ion-toggle') ||
      target.closest('ion-checkbox') ||
      target.closest('ion-radio') ||
      target.closest('ion-segment-button') ||
      target.closest('ion-chip') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea')

    if (isInteractiveElement) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

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
          <span>Mode demonstration - Navigation uniquement</span>
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

      {/* Overlay transparent pour intercepter les clics */}
      <div
        onClick={handleOverlayClick}
        onMouseDown={handleOverlayClick}
        style={{
          position: 'fixed',
          top: '40px', // Sous le bandeau
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998,
          pointerEvents: 'auto',
          background: 'transparent'
        }}
      />

      {/* Style pour decaler le contenu sous le bandeau */}
      <style>{`
        ion-app {
          margin-top: 40px !important;
        }
        ion-header {
          margin-top: 0 !important;
        }
        /* Desactiver visuellement les elements interactifs */
        .demo-mode ion-button:not(.demo-exit-btn),
        .demo-mode ion-fab-button,
        .demo-mode ion-input,
        .demo-mode ion-select,
        .demo-mode ion-toggle,
        .demo-mode ion-checkbox {
          opacity: 0.7;
        }
      `}</style>
    </>
  )
}

export default DemoOverlay
