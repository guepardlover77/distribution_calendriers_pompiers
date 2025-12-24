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
import { locationOutline, searchOutline, checkmarkCircle, refreshOutline, chevronForwardOutline, alertCircleOutline } from 'ionicons/icons'
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
type AddressMode = 'detecting' | 'detected' | 'error'

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
  const cityAbortRef = useRef<AbortController | null>(null)

  // Etat pour la recherche d'adresse manuelle
  const [addressQuery, setAddressQuery] = useState(distribution?.address || '')
  const [addressResults, setAddressResults] = useState<AddressFeature[]>([])
  const [showResults, setShowResults] = useState(false)
  const [addressSelected, setAddressSelected] = useState(!!distribution?.address)
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const addressAbortRef = useRef<AbortController | null>(null)

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

  // Fonction optimisee pour le reverse geocoding
  const reverseGeocode = async (lat: number, lng: number): Promise<{
    label: string
    city: string
    citycode: string
    postcode: string
  } | null> => {
    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/reverse/?lon=${lng}&lat=${lat}&limit=1`
      )
      if (!response.ok) return null

      const data = await response.json()
      if (data.features && data.features.length > 0) {
        const props = data.features[0].properties
        return {
          label: props.label || '',
          city: props.city || '',
          citycode: props.citycode || '',
          postcode: props.postcode || ''
        }
      }
      return null
    } catch {
      return null
    }
  }

  // Detection automatique de l'adresse - Version optimisee
  const detectAddressAutomatically = async () => {
    setAddressMode('detecting')
    setDetectionError('')

    try {
      // Verifier/demander la permission rapidement
      const permission = await Geolocation.checkPermissions().catch(() => null)

      if (!permission || permission.location !== 'granted') {
        const request = await Geolocation.requestPermissions().catch(() => null)
        if (!request || request.location !== 'granted') {
          setDetectionError('Permission de localisation refusee')
          setAddressMode('error')
          return
        }
      }

      // Strategie: getCurrentPosition rapide, puis watchPosition si besoin
      const GOOD_ACCURACY = 30 // 30m est suffisant pour une adresse
      const FAST_TIMEOUT = 3000 // 3 secondes pour la premiere tentative
      const MAX_TIMEOUT = 6000 // 6 secondes max total

      let bestPosition: { lat: number; lng: number; accuracy: number } | null = null
      let addressResult: Awaited<ReturnType<typeof reverseGeocode>> = null

      // 1. Essayer getCurrentPosition d'abord (plus rapide)
      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: FAST_TIMEOUT,
          maximumAge: 5000 // Accepter une position de moins de 5 secondes
        })

        bestPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        }
        console.log(`[Geo] Position rapide: ${bestPosition.accuracy}m`)

        // Lancer le reverse geocoding immediatement en parallele
        const geocodePromise = reverseGeocode(bestPosition.lat, bestPosition.lng)

        // Si precision suffisante, on a fini
        if (bestPosition.accuracy <= GOOD_ACCURACY) {
          addressResult = await geocodePromise
        } else {
          // Sinon, essayer d'ameliorer avec watchPosition en parallele
          const improvePromise = new Promise<{ lat: number; lng: number; accuracy: number } | null>((resolve) => {
            let watchId: string | null = null
            const timeout = setTimeout(() => {
              if (watchId) Geolocation.clearWatch({ id: watchId })
              resolve(null)
            }, MAX_TIMEOUT - FAST_TIMEOUT)

            Geolocation.watchPosition(
              { enableHighAccuracy: true, timeout: MAX_TIMEOUT, maximumAge: 0 },
              (pos, err) => {
                if (err || !pos) return
                if (pos.coords.accuracy < (bestPosition?.accuracy || 999)) {
                  clearTimeout(timeout)
                  if (watchId) Geolocation.clearWatch({ id: watchId })
                  resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                  })
                }
              }
            ).then(id => { watchId = id })
          })

          // Attendre les deux en parallele
          const [geocodeResult, improvedPosition] = await Promise.all([
            geocodePromise,
            improvePromise
          ])

          if (improvedPosition && improvedPosition.accuracy < bestPosition.accuracy) {
            console.log(`[Geo] Position amelioree: ${improvedPosition.accuracy}m`)
            bestPosition = improvedPosition
            // Re-geocoder avec la meilleure position
            addressResult = await reverseGeocode(bestPosition.lat, bestPosition.lng)
          } else {
            addressResult = geocodeResult
          }
        }
      } catch {
        // getCurrentPosition a echoue, essayer watchPosition
        console.log('[Geo] getCurrentPosition echoue, fallback watchPosition')

        await new Promise<void>((resolve, reject) => {
          let watchId: string | null = null
          const timeout = setTimeout(() => {
            if (watchId) Geolocation.clearWatch({ id: watchId })
            if (bestPosition) resolve()
            else reject(new Error('Timeout'))
          }, MAX_TIMEOUT)

          Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: MAX_TIMEOUT, maximumAge: 0 },
            (pos, err) => {
              if (err || !pos) return
              const newPos = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy
              }

              if (!bestPosition || newPos.accuracy < bestPosition.accuracy) {
                bestPosition = newPos
                console.log(`[Geo] Position: ${newPos.accuracy}m`)

                if (newPos.accuracy <= GOOD_ACCURACY) {
                  clearTimeout(timeout)
                  if (watchId) Geolocation.clearWatch({ id: watchId })
                  resolve()
                }
              }
            }
          ).then(id => { watchId = id })
        })

        if (bestPosition) {
          addressResult = await reverseGeocode(bestPosition.lat, bestPosition.lng)
        }
      }

      // Traiter le resultat
      if (bestPosition) {
        if (addressResult) {
          setDetectedAddress({
            ...addressResult,
            lat: bestPosition.lat,
            lng: bestPosition.lng
          })
          setAddressMode('detected')
        } else {
          setDetectedAddress({
            label: '',
            city: '',
            citycode: '',
            postcode: '',
            lat: bestPosition.lat,
            lng: bestPosition.lng
          })
          setDetectionError('Aucune adresse trouvee a proximite')
          setAddressMode('error')
        }
      } else {
        setDetectionError('Impossible de detecter votre position')
        setAddressMode('error')
      }
    } catch (err) {
      console.error('[Geo] Erreur:', err)
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

  // Recherche de ville via l'API Base Adresse Nationale
  const searchCity = async (query: string) => {
    if (query.length < 2) {
      setCityResults([])
      setShowCityResults(false)
      return
    }

    // Annuler la requete precedente
    if (cityAbortRef.current) {
      cityAbortRef.current.abort()
    }
    cityAbortRef.current = new AbortController()

    setSearchingCity(true)
    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&type=municipality&limit=5`,
        { signal: cityAbortRef.current.signal }
      )
      if (response.ok) {
        const data = await response.json()
        setCityResults(data.features || [])
        setShowCityResults(true)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Erreur recherche ville:', err)
      }
    } finally {
      setSearchingCity(false)
    }
  }

  // Debounce de la recherche ville (200ms pour plus de reactivite)
  const handleCityInput = (value: string) => {
    setCityQuery(value)

    if (citySearchTimeoutRef.current) {
      clearTimeout(citySearchTimeoutRef.current)
    }

    citySearchTimeoutRef.current = setTimeout(() => {
      searchCity(value)
    }, 200)
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

    // Annuler la requete precedente
    if (addressAbortRef.current) {
      addressAbortRef.current.abort()
    }
    addressAbortRef.current = new AbortController()

    setSearching(true)
    try {
      let url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`
      if (selectedCity?.citycode) {
        url += `&citycode=${selectedCity.citycode}`
      }

      const response = await fetch(url, { signal: addressAbortRef.current.signal })
      if (response.ok) {
        const data = await response.json()
        setAddressResults(data.features || [])
        setShowResults(true)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Erreur recherche adresse:', err)
      }
    } finally {
      setSearching(false)
    }
  }

  // Debounce de la recherche (200ms pour plus de reactivite)
  const handleAddressInput = (value: string) => {
    setAddressQuery(value)
    setAddressSelected(false)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchAddress(value)
    }, 200)
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

    // Validation de l'adresse pour les nouvelles distributions
    if (!isEdit && !addressSelected) {
      setError('Veuillez selectionner une adresse (GPS ou recherche)')
      setLoading(false)
      return
    }

    try {
      const data = {
        ...formData,
        address: addressQuery || formData.address,
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
                {/* Adresse validee - affichee en premier si selectionnee */}
                {addressSelected && (
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
                          {formData.address}
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

                {/* Interface principale - visible quand adresse non validee */}
                {!addressSelected && (
                  <div style={{
                    background: 'var(--ion-color-light)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px'
                  }}>
                    {/* Barre de recherche d'adresse - TOUJOURS VISIBLE */}
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px'
                      }}>
                        <IonIcon icon={searchOutline} style={{ color: 'var(--ion-color-primary)' }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                          Rechercher une adresse
                        </span>
                      </div>

                      {/* Selection de la ville */}
                      <div style={{ marginBottom: '8px', position: 'relative' }}>
                        {selectedCity ? (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
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
                          <div style={{ position: 'relative' }}>
                            <IonItem style={{ '--background': 'var(--card-background)', '--border-radius': '8px' }}>
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
                                background: 'var(--dropdown-background)',
                                border: '1px solid var(--dropdown-border)',
                                borderRadius: '8px',
                                maxHeight: '150px',
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
                                      borderBottom: index < cityResults.length - 1 ? '1px solid var(--border-color-medium)' : 'none'
                                    }}
                                  >
                                    <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-primary)' }}>{feature.properties.label}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{feature.properties.context}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Recherche d'adresse */}
                      {selectedCity && (
                        <div style={{ position: 'relative' }}>
                          <IonItem style={{ '--background': 'var(--card-background)', '--border-radius': '8px' }}>
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
                              background: 'var(--dropdown-background)',
                              border: '1px solid var(--dropdown-border)',
                              borderRadius: '8px',
                              maxHeight: '150px',
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
                                    borderBottom: index < addressResults.length - 1 ? '1px solid var(--border-color-medium)' : 'none'
                                  }}
                                >
                                  <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-primary)' }}>{feature.properties.label}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{feature.properties.context}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Separateur */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      margin: '16px 0'
                    }}>
                      <div style={{ flex: 1, height: '1px', background: 'var(--border-color-medium)' }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ou</span>
                      <div style={{ flex: 1, height: '1px', background: 'var(--border-color-medium)' }} />
                    </div>

                    {/* Section GPS */}
                    <div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px'
                      }}>
                        <IonIcon icon={locationOutline} style={{ color: 'var(--ion-color-success)' }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                          Detection automatique
                        </span>
                      </div>

                      {/* Detection en cours */}
                      {addressMode === 'detecting' && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px',
                          background: 'var(--card-background)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)'
                        }}>
                          <IonSpinner name="crescent" style={{ width: '24px', height: '24px' }} />
                          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                            Detection GPS en cours...
                          </span>
                        </div>
                      )}

                      {/* Adresse detectee */}
                      {addressMode === 'detected' && detectedAddress && (
                        <div
                          onClick={useDetectedAddress}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            background: '#dcfce7',
                            borderRadius: '8px',
                            border: '2px solid #22c55e',
                            cursor: 'pointer'
                          }}
                        >
                          <IonIcon icon={checkmarkCircle} style={{ fontSize: '24px', color: '#16a34a', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '11px', color: '#166534', marginBottom: '2px' }}>
                              Adresse detectee - Appuyez pour utiliser
                            </div>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color: '#14532d',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {detectedAddress.label}
                            </div>
                          </div>
                          <IonIcon icon={chevronForwardOutline} style={{ fontSize: '20px', color: '#16a34a' }} />
                        </div>
                      )}

                      {/* Erreur de detection */}
                      {addressMode === 'error' && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px',
                          background: '#fef2f2',
                          borderRadius: '8px',
                          border: '1px solid #fecaca'
                        }}>
                          <IonIcon icon={alertCircleOutline} style={{ fontSize: '24px', color: '#dc2626', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', color: '#991b1b' }}>
                              {detectionError}
                            </div>
                          </div>
                          <IonButton
                            fill="clear"
                            size="small"
                            onClick={detectAddressAutomatically}
                          >
                            <IonIcon icon={refreshOutline} />
                          </IonButton>
                        </div>
                      )}
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
