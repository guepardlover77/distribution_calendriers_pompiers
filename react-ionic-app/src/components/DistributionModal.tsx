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
  IonIcon,
  useIonToast
} from '@ionic/react'
import { locationOutline } from 'ionicons/icons'
import { Geolocation } from '@capacitor/geolocation'
import { useDistributionsStore } from '@/stores/distributionsStore'
import { useAuthStore } from '@/stores/authStore'
import { Distribution } from '@/services/storage'

interface AddressFeature {
  properties: {
    label: string
    context: string
    citycode?: string
    city?: string
  }
  geometry: {
    coordinates: [number, number] // [lng, lat]
  }
}

interface CityFeature {
  properties: {
    label: string
    citycode: string
    city: string
    context: string
  }
}

// Cle localStorage pour la ville persistante
const SAVED_CITY_KEY = 'pompiers_selected_city'

interface SavedCity {
  label: string
  citycode: string
  city: string
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

  // Etat pour la ville (persistante)
  const [selectedCity, setSelectedCity] = useState<SavedCity | null>(() => {
    const saved = localStorage.getItem(SAVED_CITY_KEY)
    return saved ? JSON.parse(saved) : null
  })
  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState<CityFeature[]>([])
  const [showCityResults, setShowCityResults] = useState(false)
  const [searchingCity, setSearchingCity] = useState(false)
  const citySearchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Etat pour la recherche d'adresse
  const [addressQuery, setAddressQuery] = useState(distribution?.address || '')
  const [addressResults, setAddressResults] = useState<AddressFeature[]>([])
  const [showResults, setShowResults] = useState(false)
  const [addressSelected, setAddressSelected] = useState(!!distribution?.address)
  const [useManualGps, setUseManualGps] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Etat pour la suggestion d'adresse par GPS
  const [suggestingAddress, setSuggestingAddress] = useState(false)

  const [formData, setFormData] = useState({
    address: distribution?.address || '',
    lat: distribution?.lat || 46.603354,
    lng: distribution?.lng || 1.888334,
    status: distribution?.status || 'effectue',
    amount: distribution?.amount || 0,
    payment_method: distribution?.payment_method || 'espece',
    notes: distribution?.notes || '',
    recipient_name: distribution?.recipient_name || ''
  })

  // Statuts qui ne necessitent pas de paiement
  const noPaymentStatuses = ['repasser', 'refus', 'maison_vide']
  const requiresPayment = !noPaymentStatuses.includes(formData.status)

  useEffect(() => {
    // Si mode manuel GPS activé et pas de distribution existante, récupérer la position
    if (useManualGps && !distribution) {
      getCurrentPosition()
    }
  }, [useManualGps, distribution])

  // Mettre le paiement a "non_specifie" quand le statut ne necessite pas de paiement
  useEffect(() => {
    if (noPaymentStatuses.includes(formData.status)) {
      setFormData(prev => ({ ...prev, payment_method: 'non_specifie', amount: 0 }))
    }
  }, [formData.status])

  const getCurrentPosition = async () => {
    try {
      // Verifier/demander la permission
      const permission = await Geolocation.checkPermissions()
      if (permission.location !== 'granted') {
        await Geolocation.requestPermissions()
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 5000
      })

      setFormData(prev => ({
        ...prev,
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }))
    } catch (error) {
      console.log('Impossible d\'obtenir la position actuelle:', error)
    }
  }

  // Recherche de ville via l'API Base Adresse Nationale
  const searchCity = async (query: string) => {
    if (query.length < 2) {
      setCityResults([])
      setShowCityResults(false)
      return
    }

    setSearchingCity(true)
    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&type=municipality&limit=5`
      )
      if (response.ok) {
        const data = await response.json()
        setCityResults(data.features || [])
        setShowCityResults(true)
      }
    } catch (err) {
      console.error('Erreur recherche ville:', err)
    } finally {
      setSearchingCity(false)
    }
  }

  // Debounce de la recherche ville
  const handleCityInput = (value: string) => {
    setCityQuery(value)

    if (citySearchTimeoutRef.current) {
      clearTimeout(citySearchTimeoutRef.current)
    }

    citySearchTimeoutRef.current = setTimeout(() => {
      searchCity(value)
    }, 300)
  }

  // Selectionner une ville
  const selectCity = (feature: CityFeature) => {
    const city: SavedCity = {
      label: feature.properties.label,
      citycode: feature.properties.citycode,
      city: feature.properties.city
    }
    setSelectedCity(city)
    localStorage.setItem(SAVED_CITY_KEY, JSON.stringify(city))
    setCityQuery('')
    setShowCityResults(false)
    setCityResults([])
    // Reset l'adresse quand on change de ville
    setAddressQuery('')
    setAddressSelected(false)
  }

  // Effacer la ville selectionnee
  const clearCity = () => {
    setSelectedCity(null)
    localStorage.removeItem(SAVED_CITY_KEY)
    setAddressQuery('')
    setAddressSelected(false)
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
      // Si une ville est selectionnee, filtrer par citycode
      let url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`
      if (selectedCity?.citycode) {
        url += `&citycode=${selectedCity.citycode}`
      }

      const response = await fetch(url)
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

  // Suggerer une adresse a partir de la position GPS de l'utilisateur
  const suggestAddressFromGps = async () => {
    setSuggestingAddress(true)
    try {
      // Verifier/demander la permission
      const permission = await Geolocation.checkPermissions()
      if (permission.location !== 'granted') {
        const request = await Geolocation.requestPermissions()
        if (request.location !== 'granted') {
          presentToast({
            message: 'Permission de localisation refusee',
            duration: 2000,
            color: 'warning',
            position: 'top'
          })
          return
        }
      }

      // Obtenir la position actuelle
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      })

      const { latitude, longitude } = position.coords

      // Appeler l'API BAN pour le reverse geocoding
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/reverse/?lon=${longitude}&lat=${latitude}`
      )

      if (!response.ok) {
        throw new Error('Erreur lors de la recherche d\'adresse')
      }

      const data = await response.json()

      if (data.features && data.features.length > 0) {
        const feature = data.features[0]
        const address = feature.properties.label
        const city = feature.properties.city
        const citycode = feature.properties.citycode

        // Mettre a jour la ville si elle n'est pas selectionnee ou differente
        if (!selectedCity || selectedCity.citycode !== citycode) {
          const newCity: SavedCity = {
            label: `${city} (${feature.properties.postcode || ''})`.trim(),
            citycode: citycode,
            city: city
          }
          setSelectedCity(newCity)
          localStorage.setItem(SAVED_CITY_KEY, JSON.stringify(newCity))
        }

        // Mettre a jour l'adresse
        setAddressQuery(address)
        setFormData(prev => ({
          ...prev,
          address: address,
          lat: latitude,
          lng: longitude
        }))
        setAddressSelected(true)

        presentToast({
          message: 'Adresse detectee avec succes',
          duration: 2000,
          color: 'success',
          position: 'top'
        })
      } else {
        presentToast({
          message: 'Aucune adresse trouvee a proximite',
          duration: 2000,
          color: 'warning',
          position: 'top'
        })
      }
    } catch (error) {
      console.error('Erreur suggestion adresse:', error)
      presentToast({
        message: 'Impossible de detecter l\'adresse',
        duration: 2000,
        color: 'danger',
        position: 'top'
      })
    } finally {
      setSuggestingAddress(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation: adresse requise (soit sélectionnée, soit manuelle avec GPS)
    if (!addressSelected && !useManualGps) {
      if (!selectedCity) {
        setError('Veuillez d\'abord selectionner une ville')
      } else {
        setError('Veuillez selectionner une adresse ou activer le mode GPS manuel')
      }
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
        binome_id: currentUser?.username || '',
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
            {/* Bouton de suggestion d'adresse par GPS */}
            {!isEdit && !useManualGps && (
              <div style={{ marginBottom: '16px' }}>
                <IonButton
                  expand="block"
                  color="secondary"
                  onClick={suggestAddressFromGps}
                  disabled={loading || suggestingAddress}
                >
                  {suggestingAddress ? (
                    <IonSpinner name="crescent" style={{ marginRight: '8px' }} />
                  ) : (
                    <IonIcon icon={locationOutline} slot="start" />
                  )}
                  {suggestingAddress ? 'Detection en cours...' : 'Detecter mon adresse'}
                </IonButton>
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: 'var(--ion-color-medium)',
                  textAlign: 'center'
                }}>
                  Utilise votre position GPS pour suggerer l'adresse
                </div>
              </div>
            )}

            {/* Separateur */}
            {!isEdit && !useManualGps && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '16px',
                gap: '12px'
              }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--ion-color-light-shade)' }} />
                <span style={{ fontSize: '12px', color: 'var(--ion-color-medium)' }}>ou recherchez manuellement</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--ion-color-light-shade)' }} />
              </div>
            )}

            {/* Recherche de ville et d'adresse (mode API BAN) */}
            {!useManualGps && (
              <>
                {/* Selection de la ville */}
                <div style={{ marginBottom: '12px', position: 'relative' }}>
                  {selectedCity ? (
                    // Ville selectionnee
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: '#e0f2fe',
                      borderRadius: '8px',
                      border: '1px solid #0ea5e9'
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#0369a1', marginBottom: '2px' }}>Ville selectionnee</div>
                        <div style={{ fontWeight: 600, color: '#0c4a6e' }}>{selectedCity.label}</div>
                      </div>
                      <IonButton
                        fill="clear"
                        size="small"
                        onClick={clearCity}
                        style={{ '--color': '#0369a1' }}
                      >
                        Changer
                      </IonButton>
                    </div>
                  ) : (
                    // Recherche de ville
                    <>
                      <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px' }}>
                        <IonInput
                          value={cityQuery}
                          onIonInput={(e) => handleCityInput(e.detail.value || '')}
                          onIonFocus={() => cityResults.length > 0 && setShowCityResults(true)}
                          label="1. Rechercher une ville"
                          labelPlacement="floating"
                          type="text"
                          placeholder="Tapez le nom de la ville..."
                          disabled={loading}
                        />
                        {searchingCity && <IonSpinner name="crescent" slot="end" />}
                      </IonItem>

                      {/* Resultats de recherche ville */}
                      {showCityResults && cityResults.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: '#ffffff',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          zIndex: 1000,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                        }}>
                          {cityResults.map((feature, index) => (
                            <div
                              key={index}
                              onClick={() => selectCity(feature)}
                              style={{
                                padding: '12px 16px',
                                cursor: 'pointer',
                                borderBottom: index < cityResults.length - 1 ? '1px solid #e5e7eb' : 'none',
                                background: '#ffffff'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                            >
                              <div style={{ fontWeight: 500, color: '#111827' }}>{feature.properties.label}</div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                {feature.properties.context}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Recherche d'adresse (seulement si ville selectionnee) */}
                {selectedCity && (
                  <div style={{ marginBottom: '16px', position: 'relative' }}>
                    <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px' }}>
                      <IonInput
                        value={addressQuery}
                        onIonInput={(e) => handleAddressInput(e.detail.value || '')}
                        onIonFocus={() => addressResults.length > 0 && setShowResults(true)}
                        label="2. Rechercher une adresse"
                        labelPlacement="floating"
                        type="text"
                        placeholder={`Adresse a ${selectedCity.city}...`}
                        disabled={loading}
                      />
                      {searching && <IonSpinner name="crescent" slot="end" />}
                    </IonItem>

                    {/* Resultats de recherche adresse */}
                    {showResults && addressResults.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                      }}>
                        {addressResults.map((feature, index) => (
                          <div
                            key={index}
                            onClick={() => selectAddress(feature)}
                            style={{
                              padding: '12px 16px',
                              cursor: 'pointer',
                              borderBottom: index < addressResults.length - 1 ? '1px solid #e5e7eb' : 'none',
                              background: '#ffffff'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                          >
                            <div style={{ fontWeight: 500, color: '#111827' }}>{feature.properties.label}</div>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              {feature.properties.context}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Indicateur d'adresse selectionnee */}
                    {addressSelected && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        background: '#dcfce7',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#166534',
                        border: '1px solid #86efac'
                      }}>
                        Adresse validee - Coordonnees GPS recuperees automatiquement
                      </div>
                    )}
                  </div>
                )}

                {/* Message si pas de ville selectionnee */}
                {!selectedCity && (
                  <div style={{
                    marginBottom: '12px',
                    padding: '12px',
                    background: '#fef3c7',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#92400e',
                    border: '1px solid #fcd34d'
                  }}>
                    Selectionnez d'abord une ville pour rechercher une adresse
                  </div>
                )}
              </>
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

            {/* Nom du destinataire */}
            <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px', marginBottom: '12px' }}>
              <IonInput
                value={formData.recipient_name}
                onIonInput={(e) => updateField('recipient_name', e.detail.value || '')}
                label="Nom et prenom du destinataire"
                labelPlacement="floating"
                type="text"
                disabled={loading}
              />
            </IonItem>

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
                <IonSelectOption value="maison_vide">Maison vide</IonSelectOption>
              </IonSelect>
            </IonItem>

            {/* Amount - visible seulement si paiement requis */}
            {requiresPayment && (
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
            )}

            {/* Payment method - visible seulement si paiement requis */}
            {requiresPayment && (
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
            )}

            {/* Message pour statuts sans paiement */}
            {!requiresPayment && (
              <div style={{
                marginBottom: '12px',
                padding: '12px',
                background: 'var(--ion-color-light)',
                borderRadius: '8px',
                fontSize: '14px',
                color: 'var(--ion-color-medium)'
              }}>
                Aucun paiement pour ce statut
              </div>
            )}

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
