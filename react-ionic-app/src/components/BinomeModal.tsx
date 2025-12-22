import React, { useState, useEffect } from 'react'
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonInput,
  IonCheckbox,
  IonLabel,
  IonText,
  IonSpinner,
  IonSelect,
  IonSelectOption,
  useIonToast
} from '@ionic/react'
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

  const [formData, setFormData] = useState({
    username: binome?.username || '',
    password: '',
    binome_name: binome?.binome_name || '',
    assigned_zone: binome?.assigned_zone || '',
    is_admin: binome?.is_admin === true || binome?.is_admin === 1 || binome?.is_admin === '1'
  })

  useEffect(() => {
    if (zones.length === 0) {
      fetchZones()
    }
  }, [zones.length, fetchZones])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (!formData.username.trim()) {
      setError('Le nom d\'utilisateur est requis')
      setLoading(false)
      return
    }

    if (!isEdit && !formData.password.trim()) {
      setError('Le mot de passe est requis pour un nouveau binome')
      setLoading(false)
      return
    }

    if (!formData.binome_name.trim()) {
      setError('Le nom du binome est requis')
      setLoading(false)
      return
    }

    try {
      const data: Partial<Binome> = {
        username: formData.username.trim(),
        binome_name: formData.binome_name.trim(),
        assigned_zone: formData.assigned_zone,
        is_admin: formData.is_admin
      }

      // N'inclure le mot de passe que s'il est fourni
      if (formData.password.trim()) {
        data.password = formData.password.trim()
      }

      if (isEdit && binome) {
        const binomeId = binome.Id || binome.id
        if (binomeId) {
          await updateBinome(binomeId, data)
        }
        presentToast({
          message: 'Binome modifie avec succes',
          duration: 2000,
          color: 'success',
          position: 'top'
        })
      } else {
        await createBinome(data)
        presentToast({
          message: 'Binome cree avec succes',
          duration: 2000,
          color: 'success',
          position: 'top'
        })
      }

      onDismiss(true)

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
  }

  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEdit ? 'Modifier' : 'Ajouter'} un binome</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => onDismiss(false)}>Fermer</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <form onSubmit={handleSubmit}>
          <IonList>
            {/* Username */}
            <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px', marginBottom: '12px' }}>
              <IonInput
                value={formData.username}
                onIonInput={(e) => updateField('username', e.detail.value || '')}
                label="Nom d'utilisateur"
                labelPlacement="floating"
                type="text"
                required
                disabled={loading || isEdit}
                placeholder="ex: jean.dupont"
              />
            </IonItem>

            {/* Password */}
            <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px', marginBottom: '12px' }}>
              <IonInput
                value={formData.password}
                onIonInput={(e) => updateField('password', e.detail.value || '')}
                label={isEdit ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}
                labelPlacement="floating"
                type="password"
                required={!isEdit}
                disabled={loading}
              />
            </IonItem>

            {/* Binome name */}
            <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px', marginBottom: '12px' }}>
              <IonInput
                value={formData.binome_name}
                onIonInput={(e) => updateField('binome_name', e.detail.value || '')}
                label="Nom complet du binome"
                labelPlacement="floating"
                type="text"
                required
                disabled={loading}
                placeholder="ex: Jean Dupont & Marie Martin"
              />
            </IonItem>

            {/* Assigned zone */}
            <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px', marginBottom: '12px' }}>
              <IonSelect
                value={formData.assigned_zone}
                onIonChange={(e) => updateField('assigned_zone', e.detail.value)}
                label="Zone assignee"
                labelPlacement="floating"
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

            {/* Is admin */}
            <IonItem style={{ '--background': 'transparent', marginBottom: '12px' }}>
              <IonCheckbox
                checked={formData.is_admin}
                onIonChange={(e) => updateField('is_admin', e.detail.checked)}
                disabled={loading}
                slot="start"
              />
              <IonLabel>Administrateur</IonLabel>
            </IonItem>
          </IonList>

          {error && (
            <div style={{
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
            {loading ? <IonSpinner name="crescent" /> : (isEdit ? 'Modifier' : 'Ajouter')}
          </IonButton>
        </form>
      </IonContent>
    </>
  )
}

export default BinomeModal
