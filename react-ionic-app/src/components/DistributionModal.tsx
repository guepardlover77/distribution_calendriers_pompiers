import React, { useState, useEffect, useRef } from 'react'
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
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonText,
  IonSpinner,
  IonCheckbox,
  IonLabel,
  useIonToast
} from '@ionic/react'
import { useDistributionsStore } from '@/stores/distributionsStore'
import { useAuthStore } from '@/stores/authStore'
import { Distribution } from '@/services/storage'

interface AddressFeature {
  properties: {
    label: string
    context: string
  }
  geometry: {
    coordinates: [number, number] // [lng, lat]
  }
}

interface DistributionModalProps {
  distribution?: Distribution
  onDismiss: (saved?: boolean) => void
}

const DistributionModal: React.FC<DistributionModalProps> = ({ distribution, onDismiss }) => {
  const [presentToast] = useIonToast()
  const createDistribution = useDistributionsStore(state => state.create)
  const updateDistribution = useDistributionsStore(state => state.update)
  const currentUser = useAuthStore(state => state.currentUser)

  const isEdit = !!distribution

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Etat pour la recherche d'adresse
  const [addressQuery, setAddressQuery] = useState(distribution?.address || '')
  const [addressResults, setAddressResults] = useState<AddressFeature[]>([])
  const [showResults, setShowResults] = useState(false)
  const [addressSelected, setAddressSelected] = useState(!!distribution?.address)
  const [useManualGps, setUseManualGps] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [formData, setFormData] = useState({
    address: distribution?.address || '',
    lat: distribution?.lat || 46.603354,
    lng: distribution?.lng || 1.888334,
    status: distribution?.status || 'effectue',
    amount: distribution?.amount || 0,
    payment_method: distribution?.payment_method || 'espece',
    notes: distribution?.notes || ''
  })

  useEffect(() => {
    // Si mode manuel GPS activé et pas de distribution existante, récupérer la position
    if (useManualGps && !distribution) {
      getCurrentPosition()
    }
  }, [useManualGps, distribution])

  const getCurrentPosition = async () => {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        })
      })
      setFormData(prev => ({
        ...prev,
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }))
    } catch {
      console.log('Impossible d\'obtenir la position actuelle')
    }
  }

  // Recherche d'adresse via l'API Base Adresse Nationale
  const searchAddress = async (query: string) => {
    if (query.length < 3) {
      setAddressResults([])
      setShowResults(false)
      return
    }

    setSearching(true)
    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`
      )
      if (response.ok) {
        const data = await response.json()
        setAddressResults(data.features || [])
        setShowResults(true)
      }
    } catch (err) {
      console.error('Erreur recherche adresse:', err)
    } finally {
      setSearching(false)
    }
  }

  // Debounce de la recherche
  const handleAddressInput = (value: string) => {
    setAddressQuery(value)
    setAddressSelected(false)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchAddress(value)
    }, 300)
  }

  // Sélectionner une adresse depuis les résultats
  const selectAddress = (feature: AddressFeature) => {
    const [lng, lat] = feature.geometry.coordinates
    setAddressQuery(feature.properties.label)
    setFormData(prev => ({
      ...prev,
      address: feature.properties.label,
      lat,
      lng
    }))
    setAddressSelected(true)
    setShowResults(false)
    setAddressResults([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation: adresse requise (soit sélectionnée, soit manuelle avec GPS)
    if (!addressSelected && !useManualGps) {
      setError('Veuillez sélectionner une adresse ou activer le mode GPS manuel')
      setLoading(false)
      return
    }

    if (useManualGps && !formData.address) {
      setError('Veuillez saisir une adresse')
      setLoading(false)
      return
    }

    try {
      const data = {
        ...formData,
        // Si mode manuel, utiliser l'adresse saisie manuellement
        address: useManualGps ? formData.address : addressQuery,
        binome_id: currentUser?.id,
        binome_name: currentUser?.binome_name || '',
        zone: currentUser?.assigned_zone || ''
      }

      if (isEdit && distribution) {
        await updateDistribution(distribution.id, data)

        presentToast({
          message: 'Distribution modifiee avec succes',
          duration: 2000,
          color: 'success',
          position: 'top'
        })
      } else {
        await createDistribution(data)

        presentToast({
          message: 'Distribution ajoutee avec succes',
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

  const updateField = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Basculer vers le mode GPS manuel
  const handleManualGpsToggle = (checked: boolean) => {
    setUseManualGps(checked)
    if (checked) {
      setAddressSelected(false)
      setShowResults(false)
    }
  }

  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEdit ? 'Modifier' : 'Ajouter'} une distribution</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => onDismiss(false)}>Fermer</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <form onSubmit={handleSubmit}>
          <IonList>
            {/* Recherche d'adresse (mode API BAN) */}
            {!useManualGps && (
              <div style={{ marginBottom: '16px', position: 'relative' }}>
                <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px' }}>
                  <IonInput
                    value={addressQuery}
                    onIonInput={(e) => handleAddressInput(e.detail.value || '')}
                    onIonFocus={() => addressResults.length > 0 && setShowResults(true)}
                    label="Rechercher une adresse"
                    labelPlacement="floating"
                    type="text"
                    placeholder="Tapez pour rechercher..."
                    disabled={loading}
                  />
                  {searching && <IonSpinner name="crescent" slot="end" />}
                </IonItem>

                {/* Résultats de recherche */}
                {showResults && addressResults.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--ion-background-color)',
                    border: '1px solid var(--ion-color-light-shade)',
                    borderRadius: '8px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    {addressResults.map((feature, index) => (
                      <div
                        key={index}
                        onClick={() => selectAddress(feature)}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderBottom: index < addressResults.length - 1 ? '1px solid var(--ion-color-light)' : 'none'
                        }}
                      >
                        <div style={{ fontWeight: 500 }}>{feature.properties.label}</div>
                        <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)' }}>
                          {feature.properties.context}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Indicateur d'adresse sélectionnée */}
                {addressSelected && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    background: 'var(--ion-color-success-tint)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: 'var(--ion-color-success-shade)'
                  }}>
                    Adresse validee - Coordonnees GPS recuperees automatiquement
                  </div>
                )}
              </div>
            )}

            {/* Checkbox pour activer le mode GPS manuel */}
            <IonItem style={{ '--background': 'transparent', marginBottom: '12px' }}>
              <IonCheckbox
                checked={useManualGps}
                onIonChange={(e) => handleManualGpsToggle(e.detail.checked)}
                disabled={loading}
                slot="start"
              />
              <IonLabel>Adresse introuvable - Utiliser les coordonnees GPS</IonLabel>
            </IonItem>

            {/* Mode manuel: Adresse + coordonnées GPS */}
            {useManualGps && (
              <>
                {/* Adresse manuelle */}
                <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px', marginBottom: '12px' }}>
                  <IonInput
                    value={formData.address}
                    onIonInput={(e) => updateField('address', e.detail.value || '')}
                    label="Adresse (saisie libre)"
                    labelPlacement="floating"
                    type="text"
                    required
                    disabled={loading}
                  />
                </IonItem>

                {/* Latitude */}
                <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px', marginBottom: '12px' }}>
                  <IonInput
                    value={formData.lat}
                    onIonInput={(e) => updateField('lat', parseFloat(e.detail.value || '0'))}
                    label="Latitude"
                    labelPlacement="floating"
                    type="number"
                    step="0.000001"
                    required
                    disabled={loading}
                  />
                </IonItem>

                {/* Longitude */}
                <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px', marginBottom: '12px' }}>
                  <IonInput
                    value={formData.lng}
                    onIonInput={(e) => updateField('lng', parseFloat(e.detail.value || '0'))}
                    label="Longitude"
                    labelPlacement="floating"
                    type="number"
                    step="0.000001"
                    required
                    disabled={loading}
                  />
                </IonItem>

                <div style={{
                  marginBottom: '16px',
                  padding: '8px 12px',
                  background: 'var(--ion-color-warning-tint)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--ion-color-warning-shade)'
                }}>
                  Position GPS actuelle chargee. Modifiez si necessaire.
                </div>
              </>
            )}

            {/* Status */}
            <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px', marginBottom: '12px' }}>
              <IonSelect
                value={formData.status}
                onIonChange={(e) => updateField('status', e.detail.value)}
                label="Statut"
                labelPlacement="floating"
                disabled={loading}
              >
                <IonSelectOption value="effectue">Effectue</IonSelectOption>
                <IonSelectOption value="repasser">A repasser</IonSelectOption>
                <IonSelectOption value="refus">Refus</IonSelectOption>
              </IonSelect>
            </IonItem>

            {/* Amount */}
            <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px', marginBottom: '12px' }}>
              <IonInput
                value={formData.amount}
                onIonInput={(e) => updateField('amount', parseFloat(e.detail.value || '0'))}
                label="Montant (EUR)"
                labelPlacement="floating"
                type="number"
                step="0.01"
                min="0"
                disabled={loading}
              />
            </IonItem>

            {/* Payment method */}
            <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px', marginBottom: '12px' }}>
              <IonSelect
                value={formData.payment_method}
                onIonChange={(e) => updateField('payment_method', e.detail.value)}
                label="Moyen de paiement"
                labelPlacement="floating"
                disabled={loading}
              >
                <IonSelectOption value="espece">Espece</IonSelectOption>
                <IonSelectOption value="cheque">Cheque</IonSelectOption>
                <IonSelectOption value="cb">Carte Bancaire</IonSelectOption>
                <IonSelectOption value="virement">Virement</IonSelectOption>
              </IonSelect>
            </IonItem>

            {/* Notes */}
            <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px', marginBottom: '12px' }}>
              <IonTextarea
                value={formData.notes}
                onIonInput={(e) => updateField('notes', e.detail.value || '')}
                label="Notes"
                labelPlacement="floating"
                rows={3}
                disabled={loading}
              />
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

export default DistributionModal
