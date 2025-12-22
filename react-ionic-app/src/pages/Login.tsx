import React, { useState } from 'react'
import { useHistory } from 'react-router-dom'
import {
  IonPage,
  IonContent,
  IonList,
  IonItem,
  IonInput,
  IonButton,
  IonText,
  IonIcon,
  IonSpinner,
  useIonToast
} from '@ionic/react'
import { flameOutline } from 'ionicons/icons'
import { useAuthStore } from '@/stores/authStore'

const Login: React.FC = () => {
  const history = useHistory()
  const [present] = useIonToast()
  const login = useAuthStore(state => state.login)
  const userDisplayName = useAuthStore(state => state.userDisplayName)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login(username, password)

      present({
        message: `Bienvenue ${userDisplayName()}`,
        duration: 2000,
        color: 'success',
        position: 'top'
      })

      history.push('/tabs/map')

    } catch (err) {
      const message = (err as Error).message || 'Erreur de connexion'
      setError(message)

      present({
        message,
        duration: 3000,
        color: 'danger',
        position: 'top'
      })

    } finally {
      setLoading(false)
    }
  }

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="login-container">
          <div className="login-header">
            <IonIcon icon={flameOutline} size="large" color="danger" />
            <h1>Calendriers Pompiers</h1>
            <p>Distribution de calendriers</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <IonList lines="none">
              <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px', marginBottom: '12px' }}>
                <IonInput
                  value={username}
                  onIonInput={(e) => setUsername(e.detail.value || '')}
                  label="Nom d'utilisateur"
                  labelPlacement="floating"
                  type="text"
                  autocomplete="username"
                  required
                  disabled={loading}
                />
              </IonItem>

              <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px', marginBottom: '12px' }}>
                <IonInput
                  value={password}
                  onIonInput={(e) => setPassword(e.detail.value || '')}
                  label="Mot de passe"
                  labelPlacement="floating"
                  type="password"
                  autocomplete="current-password"
                  required
                  disabled={loading}
                />
              </IonItem>
            </IonList>

            {error && (
              <div className="error-message" style={{
                marginTop: '16px',
                padding: '12px',
                background: 'var(--ion-color-danger-tint)',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <IonText color="danger">
                  <p style={{ margin: 0, fontSize: '14px' }}>{error}</p>
                </IonText>
              </div>
            )}

            <IonButton
              expand="block"
              type="submit"
              disabled={loading}
              className="ion-margin-top"
            >
              {loading ? <IonSpinner name="crescent" /> : 'Se connecter'}
            </IonButton>

            <div className="demo-credentials">
              <IonText color="medium">
                <p><small>Identifiants demo: admin / admin123</small></p>
              </IonText>
            </div>
          </form>
        </div>
      </IonContent>
    </IonPage>
  )
}

export default Login
