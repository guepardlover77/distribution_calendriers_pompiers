import React, { useState, useEffect } from 'react'
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonInput,
  IonCheckbox,
  IonText,
  IonSpinner,
  IonSelect,
  IonSelectOption,
  IonIcon,
  useIonToast
} from '@ionic/react'
import { 
  personOutline, 
  lockClosedOutline, 
  peopleOutline, 
  mapOutline,
  shieldCheckmarkOutline,
  checkmarkCircle,
  alertCircle
} from 'ionicons/icons'
import { useBinomesStore, Binome } from '@/stores/binomesStore'
import { useZonesStore } from '@/stores/zonesStore'

interface BinomeModalProps {
  binome?: Binome
  onDismiss: (saved?: boolean) => void
}

const BinomeModal: React.FC<BinomeModalProps> = ({ binome, onDismiss }) => {
  const [presentToast] = useIonToast()
  const createBinome = useBinomesStore(state => state.createBinome)
  const updateBinome = useBinomesStore(state => state.updateBinome)
  const zones = useZonesStore(state => state.zones)
  const fetchZones = useZonesStore(state => state.fetchZones)

  const isEdit = !!binome

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    username: binome?.username || '',
    password: '',
    binome_name: binome?.binome_name || '',
    assigned_zone: binome?.assigned_zone || '',
    is_admin: binome?.is_admin === true || binome?.is_admin === 1 || binome?.is_admin === '1'
  })

  // Validation en temps réel
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (zones.length === 0) {
      fetchZones()
    }
  }, [zones.length, fetchZones])

  const validateField = (field: string, value: string) => {
    switch (field) {
      case 'username':
        if (!value.trim()) return 'Requis'
        if (value.length < 3) return 'Min. 3 caractères'
        if (!/^[a-zA-Z0-9._-]+$/.test(value)) return 'Caractères invalides'
        return ''
      case 'password':
        if (!isEdit && !value.trim()) return 'Requis'
        if (value && value.length < 4) return 'Min. 4 caractères'
        return ''
      case 'binome_name':
        if (!value.trim()) return 'Requis'
        if (value.length < 2) return 'Min. 2 caractères'
        return ''
      default:
        return ''
    }
  }

  const getFieldError = (field: string) => {
    if (!touched[field]) return ''
    return validateField(field, formData[field as keyof typeof formData] as string)
  }

  const isFormValid = () => {
    return !validateField('username', formData.username) &&
           !validateField('password', formData.password) &&
           !validateField('binome_name', formData.binome_name)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Marquer tous les champs comme touchés
    setTouched({ username: true, password: true, binome_name: true })
    
    if (!isFormValid()) {
      setError('Veuillez corriger les erreurs')
      return
    }

    setLoading(true)
    setError('')

    try {
      const data: Partial<Binome> = {
        username: formData.username.trim(),
        binome_name: formData.binome_name.trim(),
        assigned_zone: formData.assigned_zone,
        is_admin: formData.is_admin
      }

      if (formData.password.trim()) {
        data.password = formData.password.trim()
      }

      if (isEdit && binome) {
        const binomeId = binome.Id || binome.id
        if (binomeId) {
          await updateBinome(binomeId, data)
        }
      } else {
        await createBinome(data)
      }

      setSuccess(true)
      presentToast({
        message: isEdit ? 'Binôme modifié' : 'Binôme créé',
        duration: 2000,
        color: 'success',
        position: 'top'
      })

      setTimeout(() => {
        onDismiss(true)
      }, 500)

    } catch (err) {
      const message = (err as Error).message || 'Erreur lors de l\'enregistrement'
      setError(message)
      presentToast({
        message,
        duration: 3000,
        color: 'danger',
        position: 'top'
      })
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEdit ? 'Modifier' : 'Nouveau'} binôme</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => onDismiss(false)}>Fermer</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ padding: '24px' }}>
          {/* Header visuel */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '32px',
            padding: '24px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            borderRadius: '20px',
            color: 'white'
          }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.2)',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <IonIcon 
                icon={success ? checkmarkCircle : peopleOutline} 
                style={{ fontSize: '36px' }} 
              />
            </div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '600' }}>
              {success ? 'Enregistré !' : (isEdit ? 'Modifier le binôme' : 'Créer un binôme')}
            </h2>
            <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>
              {success ? 'Redirection...' : 'Remplissez les informations ci-dessous'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '8px',
                color: getFieldError('username') ? 'var(--ion-color-danger)' : '#374151'
              }}>
                <IonIcon icon={personOutline} />
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Nom d'utilisateur</span>
                {getFieldError('username') && (
                  <span style={{ 
                    marginLeft: 'auto', 
                    fontSize: '12px', 
                    color: 'var(--ion-color-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <IonIcon icon={alertCircle} />
                    {getFieldError('username')}
                  </span>
                )}
              </div>
              <IonItem 
                style={{ 
                  '--background': 'var(--ion-color-light)', 
                  '--border-radius': '12px',
                  '--border-color': getFieldError('username') ? 'var(--ion-color-danger)' : 'transparent',
                  '--border-width': '2px',
                  '--border-style': 'solid'
                }}
              >
                <IonInput
                  value={formData.username}
                  onIonInput={(e) => updateField('username', e.detail.value || '')}
                  onIonBlur={() => handleBlur('username')}
                  type="text"
                  placeholder="ex: jean.dupont"
                  disabled={loading || isEdit}
                />
              </IonItem>
              {isEdit && (
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'var(--ion-color-medium)' }}>
                  Le nom d'utilisateur ne peut pas être modifié
                </p>
              )}
            </div>

            {/* Password */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '8px',
                color: getFieldError('password') ? 'var(--ion-color-danger)' : '#374151'
              }}>
                <IonIcon icon={lockClosedOutline} />
                <span style={{ fontSize: '14px', fontWeight: '500' }}>
                  {isEdit ? 'Nouveau mot de passe' : 'Mot de passe'}
                </span>
                {getFieldError('password') && (
                  <span style={{ 
                    marginLeft: 'auto', 
                    fontSize: '12px', 
                    color: 'var(--ion-color-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <IonIcon icon={alertCircle} />
                    {getFieldError('password')}
                  </span>
                )}
              </div>
              <IonItem 
                style={{ 
                  '--background': 'var(--ion-color-light)', 
                  '--border-radius': '12px',
                  '--border-color': getFieldError('password') ? 'var(--ion-color-danger)' : 'transparent',
                  '--border-width': '2px',
                  '--border-style': 'solid'
                }}
              >
                <IonInput
                  value={formData.password}
                  onIonInput={(e) => updateField('password', e.detail.value || '')}
                  onIonBlur={() => handleBlur('password')}
                  type="password"
                  placeholder={isEdit ? 'Laisser vide pour ne pas changer' : '••••••••'}
                  disabled={loading}
                />
              </IonItem>
            </div>

            {/* Binome name */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '8px',
                color: getFieldError('binome_name') ? 'var(--ion-color-danger)' : '#374151'
              }}>
                <IonIcon icon={peopleOutline} />
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Nom du binôme</span>
                {getFieldError('binome_name') && (
                  <span style={{ 
                    marginLeft: 'auto', 
                    fontSize: '12px', 
                    color: 'var(--ion-color-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <IonIcon icon={alertCircle} />
                    {getFieldError('binome_name')}
                  </span>
                )}
              </div>
              <IonItem 
                style={{ 
                  '--background': 'var(--ion-color-light)', 
                  '--border-radius': '12px',
                  '--border-color': getFieldError('binome_name') ? 'var(--ion-color-danger)' : 'transparent',
                  '--border-width': '2px',
                  '--border-style': 'solid'
                }}
              >
                <IonInput
                  value={formData.binome_name}
                  onIonInput={(e) => updateField('binome_name', e.detail.value || '')}
                  onIonBlur={() => handleBlur('binome_name')}
                  type="text"
                  placeholder="ex: Jean Dupont & Marie Martin"
                  disabled={loading}
                />
              </IonItem>
            </div>

            {/* Assigned zone */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '8px',
                color: '#374151'
              }}>
                <IonIcon icon={mapOutline} />
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Zone assignée</span>
                <span style={{ 
                  marginLeft: 'auto', 
                  fontSize: '12px', 
                  color: 'var(--ion-color-medium)'
                }}>
                  Optionnel
                </span>
              </div>
              <IonItem 
                style={{ 
                  '--background': 'var(--ion-color-light)', 
                  '--border-radius': '12px'
                }}
              >
                <IonSelect
                  value={formData.assigned_zone}
                  onIonChange={(e) => updateField('assigned_zone', e.detail.value)}
                  placeholder="Sélectionner une zone"
                  interface="action-sheet"
                  disabled={loading}
                >
                  <IonSelectOption value="">Aucune zone</IonSelectOption>
                  {zones.map(zone => (
                    <IonSelectOption key={zone.Id || zone.id} value={zone.name}>
                      {zone.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            </div>

            {/* Is admin toggle */}
            <div 
              onClick={() => !loading && updateField('is_admin', !formData.is_admin)}
              style={{ 
                marginBottom: '24px',
                padding: '16px',
                background: formData.is_admin 
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%)'
                  : 'var(--ion-color-light)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: loading ? 'not-allowed' : 'pointer',
                border: formData.is_admin ? '2px solid #f59e0b' : '2px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: formData.is_admin 
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                  : '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}>
                <IonIcon 
                  icon={shieldCheckmarkOutline} 
                  style={{ color: 'white', fontSize: '22px' }} 
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: '600', 
                  color: formData.is_admin ? '#d97706' : '#374151',
                  marginBottom: '2px'
                }}>
                  Administrateur
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ion-color-medium)' }}>
                  Accès complet à la gestion
                </div>
              </div>
              <IonCheckbox
                checked={formData.is_admin}
                disabled={loading}
                style={{ '--size': '24px' }}
              />
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                marginBottom: '20px',
                padding: '14px',
                background: 'var(--ion-color-danger-tint)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <IonIcon 
                  icon={alertCircle} 
                  style={{ color: 'var(--ion-color-danger)', fontSize: '20px' }} 
                />
                <IonText color="danger">
                  <span style={{ fontSize: '14px' }}>{error}</span>
                </IonText>
              </div>
            )}

            {/* Submit button */}
            <IonButton
              expand="block"
              type="submit"
              disabled={loading || success}
              style={{ 
                '--border-radius': '12px',
                '--background': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                height: '52px',
                fontWeight: '600'
              }}
            >
              {loading ? (
                <IonSpinner name="crescent" />
              ) : success ? (
                <>
                  <IonIcon icon={checkmarkCircle} slot="start" />
                  Enregistré
                </>
              ) : (
                isEdit ? 'Enregistrer les modifications' : 'Créer le binôme'
              )}
            </IonButton>
          </form>
        </div>
      </IonContent>
    </>
  )
}

export default BinomeModal
