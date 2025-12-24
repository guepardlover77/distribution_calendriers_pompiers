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
  IonIcon,
  useIonToast
} from '@ionic/react'
import { locationOutline, searchOutline, navigateOutline, checkmarkCircle, refreshOutline } from 'ionicons/icons'
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
    postcode?: string
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

// Mode de saisie d'adresse
type AddressMode = 'detecting' | 'detected' | 'manual' | 'gps' | 'error'

interface DetectedAddress {
  label: string
  city: string
  citycode: string
  postcode: string
  lat: number
  lng: number
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

  // Mode de saisie d'adresse
  const [addressMode, setAddressMode] = useState<AddressMode>(isEdit ? 'detected' : 'detecting')
  const [detectedAddress, setDetectedAddress] = useState<DetectedAddress | null>(null)
  const [detectionError, setDetectionError] = useState<string>('')

  // Etat pour la ville (persistante) - utilise en mode manuel
  const [selectedCity, setSelectedCity] = useState<SavedCity | null>(() => {
    const saved = localStorage.getItem(SAVED_CITY_KEY)
    return saved ? JSON.parse(saved) : null
  })
  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState<CityFeature[]>([])
  const [showCityResults, setShowCityResults] = useState(false)
  const [searchingCity, setSearchingCity] = useState(false)
  const citySearchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Etat pour la recherche d'adresse manuelle
  const [addressQuery, setAddressQuery] = useState(distribution?.address || '')
  const [addressResults, setAddressResults] = useState<AddressFeature[]>([])
  const [showResults, setShowResults] = useState(false)
  const [addressSelected, setAddressSelected] = useState(!!distribution?.address)
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  // Detection automatique a l'ouverture du modal
  useEffect(() => {
    if (!isEdit) {
      detectAddressAutomatically()
    }
  }, [isEdit])

  // Mettre le paiement a "non_specifie" quand le statut ne necessite pas de paiement
  useEffect(() => {
    if (noPaymentStatuses.includes(formData.status)) {
      setFormData(prev => ({ ...prev, payment_method: 'non_specifie', amount: 0 }))
    }
  }, [formData.status])

  // Detection automatique de l'adresse avec haute precision
  const detectAddressAutomatically = async () => {
    setAddressMode('detecting')
    setDetectionError('')

    try {
      // Verifier/demander la permission
      const permission = await Geolocation.checkPermissions()
      if (permission.location !== 'granted') {
        const request = await Geolocation.requestPermissions()
        if (request.location !== 'granted') {
          setDetectionError('Permission de localisation refusee')
          setAddressMode('error')
          return
        }
      }

      // Utiliser watchPosition pour obtenir la position la plus precise
      // On collecte les positions pendant quelques secondes et on garde la meilleure
      const positions: { lat: number; lng: number; accuracy: number }[] = []
      const maxWaitTime = 8000 // 8 secondes max
      const minAccuracy = 10 // On s'arrete si on atteint 10m de precision
      const startTime = Date.now()

      const getBestPosition = (): Promise<{ latitude: number; longitude: number }> => {
        return new Promise((resolve, reject) => {
          let watchId: string | null = null
          let timeoutId: NodeJS.Timeout | null = null

          const cleanup = () => {
            if (watchId) {
              Geolocation.clearWatch({ id: watchId })
            }
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
          }

          const finalize = () => {
            cleanup()
            if (positions.length === 0) {
              reject(new Error('Aucune position obtenue'))
              return
            }
            // Trier par precision (accuracy la plus basse = meilleure precision)
            positions.sort((a, b) => a.accuracy - b.accuracy)
            const best = positions[0]
            console.log(`[Geolocation] Meilleure position: ${best.accuracy}m de precision sur ${positions.length} mesures`)
            resolve({ latitude: best.lat, longitude: best.lng })
          }

          // Timeout de securite
          timeoutId = setTimeout(() => {
            console.log('[Geolocation] Timeout atteint, utilisation de la meilleure position disponible')
            finalize()
          }, maxWaitTime)

          // Demarrer la surveillance
          Geolocation.watchPosition(
            {
              enableHighAccuracy: true,
              timeout: maxWaitTime,
              maximumAge: 0 // Forcer une nouvelle position, pas de cache
            },
            (position, err) => {
              if (err) {
                console.error('[Geolocation] Erreur watchPosition:', err)
                return
              }

              if (position) {
                const accuracy = position.coords.accuracy
                console.log(`[Geolocation] Position recue: precision ${accuracy}m`)

                positions.push({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  accuracy: accuracy
                })

                // Si on a une excellente precision, on peut s'arreter
                if (accuracy <= minAccuracy) {
                  console.log('[Geolocation] Precision optimale atteinte')
                  finalize()
                }
                // Sinon, on continue pendant au moins 3 secondes pour avoir plusieurs mesures
                else if (Date.now() - startTime > 3000 && positions.length >= 3 && accuracy <= 20) {
                  console.log('[Geolocation] Precision acceptable avec plusieurs mesures')
                  finalize()
                }
              }
            }
          ).then(id => {
            watchId = id
          }).catch(err => {
            cleanup()
            reject(err)
          })
        })
      }

      const { latitude, longitude } = await getBestPosition()

      // Appeler l'API BAN pour le reverse geocoding
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/reverse/?lon=${longitude}&lat=${latitude}`
      )

      if (!response.ok) {
        throw new Error('Erreur API adresse')
      }

      const data = await response.json()

      if (data.features && data.features.length > 0) {
        const feature = data.features[0]
        setDetectedAddress({
          label: feature.properties.label,
          city: feature.properties.city || '',
          citycode: feature.properties.citycode || '',
          postcode: feature.properties.postcode || '',
          lat: latitude,
          lng: longitude
        })
        setAddressMode('detected')
      } else {
        // Pas d'adresse trouvee mais on a les coordonnees
        setDetectedAddress({
          label: '',
          city: '',
          citycode: '',
          postcode: '',
          lat: latitude,
          lng: longitude
        })
        setDetectionError('Aucune adresse trouvee a proximite')
        setAddressMode('error')
      }
    } catch (err) {
      console.error('Erreur detection adresse:', err)
      setDetectionError('Impossible de detecter votre position')
      setAddressMode('error')
    }
  }

  // Utiliser l'adresse detectee
  const useDetectedAddress = () => {
    if (!detectedAddress) return

    setFormData(prev => ({
      ...prev,
      address: detectedAddress.label,
      lat: detectedAddress.lat,
      lng: detectedAddress.lng
    }))
    setAddressQuery(detectedAddress.label)
    setAddressSelected(true)

    // Sauvegarder la ville
    if (detectedAddress.city && detectedAddress.citycode) {
      const city: SavedCity = {
        label: `${detectedAddress.city} (${detectedAddress.postcode})`,
        citycode: detectedAddress.citycode,
        city: detectedAddress.city
      }
      setSelectedCity(city)
      localStorage.setItem(SAVED_CITY_KEY, JSON.stringify(city))
    }

    presentToast({
      message: 'Adresse validee',
      duration: 1500,
      color: 'success',
      position: 'top'
    })
  }

  // Passer en mode recherche manuelle
  const switchToManualMode = () => {
    setAddressMode('manual')
    setAddressSelected(false)
    setAddressQuery('')
  }

  // Passer en mode GPS uniquement
  const switchToGpsMode = () => {
    setAddressMode('gps')
    if (detectedAddress) {
      setFormData(prev => ({
        ...prev,
        lat: detectedAddress.lat,
        lng: detectedAddress.lng
      }))
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

  // Selectionner une adresse depuis les resultats
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

    // Validation selon le mode
    if (addressMode === 'detected' && !addressSelected) {
      setError('Veuillez valider l\'adresse detectee ou choisir une autre option')
      setLoading(false)
      return
    }

    if (addressMode === 'manual' && !addressSelected) {
      setError('Veuillez selectionner une adresse')
      setLoading(false)
      return
    }

    if (addressMode === 'gps' && !formData.address) {
      setError('Veuillez saisir une adresse')
      setLoading(false)
      return
    }

    try {
      const data = {
        ...formData,
        address: addressMode === 'gps' ? formData.address : addressQuery || formData.address,
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
            {/* Section Adresse */}
            {!isEdit && (
              <>
                {/* Mode Detection en cours */}
                {addressMode === 'detecting' && (
                  <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    background: 'var(--ion-color-light)',
                    borderRadius: '12px',
                    marginBottom: '16px'
                  }}>
                    <IonSpinner name="crescent" style={{ width: '48px', height: '48px' }} />
                    <p style={{ margin: '16px 0 0', color: 'var(--ion-color-medium)' }}>
                      Detection de votre adresse en cours...
                    </p>
                  </div>
                )}

                {/* Mode Adresse detectee */}
                {addressMode === 'detected' && detectedAddress && !addressSelected && (
                  <div style={{
                    background: '#dcfce7',
                    border: '2px solid #22c55e',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <IonIcon icon={locationOutline} style={{ fontSize: '24px', color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: '#166534', marginBottom: '4px', fontWeight: 500 }}>
                          Adresse detectee
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: '#14532d' }}>
                          {detectedAddress.label}
                        </div>
                      </div>
                    </div>

                    <IonButton
                      expand="block"
                      color="success"
                      onClick={useDetectedAddress}
                      style={{ marginTop: '16px' }}
                    >
                      <IonIcon icon={checkmarkCircle} slot="start" />
                      Utiliser cette adresse
                    </IonButton>

                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      marginTop: '12px'
                    }}>
                      <IonButton
                        expand="block"
                        fill="outline"
                        color="medium"
                        onClick={switchToManualMode}
                        style={{ flex: 1 }}
                      >
                        <IonIcon icon={searchOutline} slot="start" />
                        Rechercher
                      </IonButton>
                      <IonButton
                        expand="block"
                        fill="outline"
                        color="medium"
                        onClick={switchToGpsMode}
                        style={{ flex: 1 }}
                      >
                        <IonIcon icon={navigateOutline} slot="start" />
                        GPS seul
                      </IonButton>
                    </div>
                  </div>
                )}

                {/* Adresse validee */}
                {addressMode === 'detected' && addressSelected && (
                  <div style={{
                    background: '#dcfce7',
                    border: '2px solid #22c55e',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <IonIcon icon={checkmarkCircle} style={{ fontSize: '24px', color: '#16a34a' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: '#166534', marginBottom: '2px' }}>
                          Adresse validee
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#14532d' }}>
                          {addressQuery || formData.address}
                        </div>
                      </div>
                      <IonButton
                        fill="clear"
                        size="small"
                        onClick={() => setAddressSelected(false)}
                      >
                        Modifier
                      </IonButton>
                    </div>
                  </div>
                )}

                {/* Mode Erreur de detection */}
                {addressMode === 'error' && (
                  <div style={{
                    background: '#fef2f2',
                    border: '2px solid #ef4444',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                      <IonIcon icon={locationOutline} style={{ fontSize: '32px', color: '#dc2626' }} />
                      <p style={{ margin: '8px 0 0', color: '#991b1b', fontWeight: 500 }}>
                        {detectionError}
                      </p>
                    </div>

                    <IonButton
                      expand="block"
                      color="danger"
                      fill="outline"
                      onClick={detectAddressAutomatically}
                      style={{ marginBottom: '8px' }}
                    >
                      <IonIcon icon={refreshOutline} slot="start" />
                      Reessayer
                    </IonButton>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <IonButton
                        expand="block"
                        fill="outline"
                        color="medium"
                        onClick={switchToManualMode}
                        style={{ flex: 1 }}
                      >
                        <IonIcon icon={searchOutline} slot="start" />
                        Rechercher
                      </IonButton>
                      <IonButton
                        expand="block"
                        fill="outline"
                        color="medium"
                        onClick={switchToGpsMode}
                        style={{ flex: 1 }}
                      >
                        <IonIcon icon={navigateOutline} slot="start" />
                        GPS seul
                      </IonButton>
                    </div>
                  </div>
                )}

                {/* Mode Recherche manuelle */}
                {addressMode === 'manual' && (
                  <div style={{
                    background: 'var(--ion-color-light)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--ion-color-dark)' }}>Recherche manuelle</span>
                      <IonButton
                        fill="clear"
                        size="small"
                        onClick={detectAddressAutomatically}
                      >
                        <IonIcon icon={locationOutline} slot="start" />
                        Detection auto
                      </IonButton>
                    </div>

                    {/* Selection de la ville */}
                    <div style={{ marginBottom: '12px', position: 'relative' }}>
                      {selectedCity ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: '#e0f2fe',
                          borderRadius: '8px',
                          border: '1px solid #0ea5e9'
                        }}>
                          <div>
                            <div style={{ fontSize: '11px', color: '#0369a1' }}>Ville</div>
                            <div style={{ fontWeight: 600, color: '#0c4a6e', fontSize: '14px' }}>{selectedCity.label}</div>
                          </div>
                          <IonButton fill="clear" size="small" onClick={clearCity}>
                            Changer
                          </IonButton>
                        </div>
                      ) : (
                        <>
                          <IonItem style={{ '--background': 'white', '--border-radius': '8px' }}>
                            <IonInput
                              value={cityQuery}
                              onIonInput={(e) => handleCityInput(e.detail.value || '')}
                              onIonFocus={() => cityResults.length > 0 && setShowCityResults(true)}
                              label="Ville"
                              labelPlacement="floating"
                              type="text"
                              placeholder="Rechercher une ville..."
                              disabled={loading}
                            />
                            {searchingCity && <IonSpinner name="crescent" slot="end" />}
                          </IonItem>

                          {showCityResults && cityResults.length > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              background: '#ffffff',
                              border: '1px solid #d1d5db',
                              borderRadius: '8px',
                              maxHeight: '180px',
                              overflowY: 'auto',
                              zIndex: 1000,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                            }}>
                              {cityResults.map((feature, index) => (
                                <div
                                  key={index}
                                  onClick={() => selectCity(feature)}
                                  style={{
                                    padding: '10px 14px',
                                    cursor: 'pointer',
                                    borderBottom: index < cityResults.length - 1 ? '1px solid #e5e7eb' : 'none'
                                  }}
                                >
                                  <div style={{ fontWeight: 500, fontSize: '14px' }}>{feature.properties.label}</div>
                                  <div style={{ fontSize: '11px', color: '#6b7280' }}>{feature.properties.context}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Recherche d'adresse */}
                    {selectedCity && (
                      <div style={{ position: 'relative' }}>
                        <IonItem style={{ '--background': 'white', '--border-radius': '8px' }}>
                          <IonInput
                            value={addressQuery}
                            onIonInput={(e) => handleAddressInput(e.detail.value || '')}
                            onIonFocus={() => addressResults.length > 0 && setShowResults(true)}
                            label="Adresse"
                            labelPlacement="floating"
                            type="text"
                            placeholder={`Adresse a ${selectedCity.city}...`}
                            disabled={loading}
                          />
                          {searching && <IonSpinner name="crescent" slot="end" />}
                        </IonItem>

                        {showResults && addressResults.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#ffffff',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            maxHeight: '180px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                          }}>
                            {addressResults.map((feature, index) => (
                              <div
                                key={index}
                                onClick={() => selectAddress(feature)}
                                style={{
                                  padding: '10px 14px',
                                  cursor: 'pointer',
                                  borderBottom: index < addressResults.length - 1 ? '1px solid #e5e7eb' : 'none'
                                }}
                              >
                                <div style={{ fontWeight: 500, fontSize: '14px' }}>{feature.properties.label}</div>
                                <div style={{ fontSize: '11px', color: '#6b7280' }}>{feature.properties.context}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {addressSelected && (
                          <div style={{
                            marginTop: '8px',
                            padding: '8px 12px',
                            background: '#dcfce7',
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: '#166534',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <IonIcon icon={checkmarkCircle} />
                            Adresse validee
                          </div>
                        )}
                      </div>
                    )}

                    {!selectedCity && (
                      <div style={{
                        padding: '10px',
                        background: '#fef3c7',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#92400e'
                      }}>
                        Selectionnez d'abord une ville
                      </div>
                    )}
                  </div>
                )}

                {/* Mode GPS seul */}
                {addressMode === 'gps' && (
                  <div style={{
                    background: 'var(--ion-color-light)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--ion-color-dark)' }}>Mode GPS</span>
                      <IonButton
                        fill="clear"
                        size="small"
                        onClick={detectAddressAutomatically}
                      >
                        <IonIcon icon={locationOutline} slot="start" />
                        Detection auto
                      </IonButton>
                    </div>

                    <IonItem style={{ '--background': 'white', '--border-radius': '8px', marginBottom: '12px' }}>
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

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <IonItem style={{ '--background': 'white', '--border-radius': '8px', flex: 1 }}>
                        <IonInput
                          value={formData.lat}
                          onIonInput={(e) => updateField('lat', parseFloat(e.detail.value || '0'))}
                          label="Latitude"
                          labelPlacement="floating"
                          type="number"
                          step="0.000001"
                          disabled={loading}
                        />
                      </IonItem>
                      <IonItem style={{ '--background': 'white', '--border-radius': '8px', flex: 1 }}>
                        <IonInput
                          value={formData.lng}
                          onIonInput={(e) => updateField('lng', parseFloat(e.detail.value || '0'))}
                          label="Longitude"
                          labelPlacement="floating"
                          type="number"
                          step="0.000001"
                          disabled={loading}
                        />
                      </IonItem>
                    </div>

                    <div style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      background: '#fef3c7',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#92400e'
                    }}>
                      Coordonnees GPS detectees automatiquement
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Mode edition - afficher l'adresse existante */}
            {isEdit && (
              <div style={{
                background: '#e0f2fe',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '12px', color: '#0369a1', marginBottom: '4px' }}>Adresse</div>
                <div style={{ fontWeight: 600, color: '#0c4a6e' }}>{distribution?.address}</div>
              </div>
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

            {/* Amount */}
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

            {/* Payment method */}
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
            disabled={loading || addressMode === 'detecting'}
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
