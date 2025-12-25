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
import { locationOutline, searchOutline, checkmarkCircle, refreshOutline, chevronForwardOutline, alertCircleOutline, homeOutline, keypadOutline } from 'ionicons/icons'
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
    street?: string        // Nom de rue (fourni par BAN pour type=housenumber)
    housenumber?: string   // Numero de rue
    score?: number         // Score de confiance
    type?: string          // "housenumber" | "street" | "locality"
  }
  geometry: {
    coordinates: [number, number] // [lng, lat]
  }
}

// Cles localStorage
const SAVED_CITY_KEY = 'pompiers_selected_city'
const SAVED_STREET_KEY = 'pompiers_saved_street'

interface SavedCity {
  label: string
  citycode: string
  city: string
}

// Rue sauvegardee pour saisie rapide du numero
interface SavedStreet {
  streetName: string      // "Rue de la Republique"
  city: string            // "Villeurbanne"
  citycode: string        // "69266"
  postcode: string        // "69100"
  fullContext: string     // "Rhone, Auvergne-Rhone-Alpes"
}

// Mode de saisie rapide du numero
type QuickNumberState = 'idle' | 'validating' | 'valid' | 'multiple' | 'not_found'

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

  // Etat pour la ville (persistante) - utilise par useDetectedAddress
  const [selectedCity, setSelectedCity] = useState<SavedCity | null>(() => {
    const saved = localStorage.getItem(SAVED_CITY_KEY)
    return saved ? JSON.parse(saved) : null
  })

  // Etat pour la recherche d'adresse manuelle
  const [addressQuery, setAddressQuery] = useState(distribution?.address || '')
  const [addressResults, setAddressResults] = useState<AddressFeature[]>([])
  const [showResults, setShowResults] = useState(false)
  const [addressSelected, setAddressSelected] = useState(!!distribution?.address)
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const addressAbortRef = useRef<AbortController | null>(null)

  // === MODE A: Saisie rapide du numero (meme rue) ===
  const [savedStreet, setSavedStreet] = useState<SavedStreet | null>(() => {
    const saved = localStorage.getItem(SAVED_STREET_KEY)
    return saved ? JSON.parse(saved) : null
  })
  const [quickNumber, setQuickNumber] = useState('')
  const [quickNumberState, setQuickNumberState] = useState<QuickNumberState>('idle')
  const [quickNumberResults, setQuickNumberResults] = useState<AddressFeature[]>([])
  const [quickNumberError, setQuickNumberError] = useState('')
  const quickNumberTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const quickNumberAbortRef = useRef<AbortController | null>(null)

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

  // === FONCTIONS POUR MODE A: Saisie rapide du numero ===

  // Extraire les infos de rue depuis une reponse BAN
  const extractStreetFromFeature = (feature: AddressFeature): SavedStreet | null => {
    const props = feature.properties

    // L'API BAN fournit 'street' pour les resultats de type housenumber
    if (props.street && props.city && props.citycode) {
      return {
        streetName: props.street,
        city: props.city,
        citycode: props.citycode,
        postcode: props.postcode || '',
        fullContext: props.context || ''
      }
    }

    // Fallback: parser depuis le label en enlevant le numero
    if (props.housenumber && props.label) {
      const streetName = props.label
        .replace(new RegExp(`^${props.housenumber}\\s+`), '')
        .replace(/,.*$/, '')
        .trim()

      if (streetName && props.city && props.citycode) {
        return {
          streetName,
          city: props.city,
          citycode: props.citycode,
          postcode: props.postcode || '',
          fullContext: props.context || ''
        }
      }
    }

    return null
  }

  // Sauvegarder/effacer la rue
  const saveStreet = (street: SavedStreet) => {
    setSavedStreet(street)
    localStorage.setItem(SAVED_STREET_KEY, JSON.stringify(street))
  }

  const clearSavedStreet = () => {
    setSavedStreet(null)
    localStorage.removeItem(SAVED_STREET_KEY)
    setQuickNumber('')
    setQuickNumberState('idle')
    setQuickNumberResults([])
    setQuickNumberError('')
  }

  // Valider un numero via l'API BAN
  const validateQuickNumber = async (number: string) => {
    if (!savedStreet || !number.trim()) {
      setQuickNumberResults([])
      setQuickNumberState('idle')
      return
    }

    // Annuler la requete precedente
    if (quickNumberAbortRef.current) {
      quickNumberAbortRef.current.abort()
    }
    quickNumberAbortRef.current = new AbortController()

    setQuickNumberState('validating')
    setQuickNumberError('')

    try {
      const query = `${number.trim()} ${savedStreet.streetName}`
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&citycode=${savedStreet.citycode}&limit=3&type=housenumber`

      const response = await fetch(url, {
        signal: quickNumberAbortRef.current.signal
      })

      if (!response.ok) throw new Error('API error')

      const data = await response.json()
      const features: AddressFeature[] = data.features || []

      if (features.length === 0) {
        setQuickNumberState('not_found')
        setQuickNumberError(`Le n${number} n'existe pas sur ${savedStreet.streetName}`)
        setQuickNumberResults([])
        return
      }

      // Filtrer les resultats qui correspondent bien a la rue
      const matchingResults = features.filter(f => {
        const street = f.properties.street?.toLowerCase() || ''
        return street === savedStreet.streetName.toLowerCase()
      })

      if (matchingResults.length === 0) {
        // Prendre les resultats meme s'ils ne matchent pas exactement
        setQuickNumberResults(features)
        setQuickNumberState('multiple')
        return
      }

      setQuickNumberResults(matchingResults)

      // Auto-selection si un seul resultat avec bon score
      if (matchingResults.length === 1 && (matchingResults[0].properties.score || 0) > 0.6) {
        selectQuickNumberResult(matchingResults[0])
      } else {
        setQuickNumberState('multiple')
      }

    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setQuickNumberState('not_found')
        setQuickNumberError('Erreur de recherche')
      }
    }
  }

  // Handler pour l'input du numero avec debounce
  const handleQuickNumberInput = (value: string) => {
    // Accepter uniquement les chiffres et lettres (pour "12 bis")
    const cleanValue = value.replace(/[^0-9a-zA-Z\s]/g, '').trim()
    setQuickNumber(cleanValue)

    if (quickNumberTimeoutRef.current) {
      clearTimeout(quickNumberTimeoutRef.current)
    }

    if (!cleanValue) {
      setQuickNumberState('idle')
      setQuickNumberResults([])
      setQuickNumberError('')
      return
    }

    // Debounce 400ms
    quickNumberTimeoutRef.current = setTimeout(() => {
      validateQuickNumber(cleanValue)
    }, 400)
  }

  // Selectionner un resultat du mode rapide
  const selectQuickNumberResult = (feature: AddressFeature) => {
    const [lng, lat] = feature.geometry.coordinates

    setFormData(prev => ({
      ...prev,
      address: feature.properties.label,
      lat,
      lng
    }))
    setAddressQuery(feature.properties.label)
    setAddressSelected(true)
    setQuickNumberState('valid')
    setQuickNumberResults([])

    // Mettre a jour la rue sauvegardee
    const street = extractStreetFromFeature(feature)
    if (street) {
      saveStreet(street)
    }

    presentToast({
      message: 'Adresse validee',
      duration: 1500,
      color: 'success',
      position: 'top'
    })
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

      // Extraire et sauvegarder la rue depuis l'adresse GPS
      // Format typique: "17 Rue de la Republique, 69100 Villeurbanne"
      const streetMatch = detectedAddress.label.match(/^\d+[a-zA-Z]?\s+(.+?),/)
      if (streetMatch) {
        const street: SavedStreet = {
          streetName: streetMatch[1],
          city: detectedAddress.city,
          citycode: detectedAddress.citycode,
          postcode: detectedAddress.postcode,
          fullContext: ''
        }
        saveStreet(street)
        setQuickNumber('')
        setQuickNumberState('idle')
      }
    }

    presentToast({
      message: 'Adresse validee',
      duration: 1500,
      color: 'success',
      position: 'top'
    })
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

    // Extraire et sauvegarder la rue pour le mode rapide
    const street = extractStreetFromFeature(feature)
    if (street) {
      saveStreet(street)
      // Reinitialiser le mode rapide pour la prochaine saisie
      setQuickNumber('')
      setQuickNumberState('idle')
    }

    presentToast({
      message: 'Adresse validee',
      duration: 1500,
      color: 'success',
      position: 'top'
    })
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
                    {/* === MODE A: Saisie rapide du numero (si rue sauvegardee) === */}
                    {savedStreet && (
                      <>
                        {/* En-tete de la rue active */}
                        <div style={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                          borderRadius: '10px',
                          padding: '14px',
                          marginBottom: '12px',
                          color: 'white'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <IonIcon icon={homeOutline} style={{ fontSize: '12px' }} />
                                RUE ACTIVE
                              </div>
                              <div style={{ fontSize: '16px', fontWeight: 700 }}>{savedStreet.streetName}</div>
                              <div style={{ fontSize: '13px', opacity: 0.9 }}>{savedStreet.city} ({savedStreet.postcode})</div>
                            </div>
                            <IonButton
                              fill="clear"
                              size="small"
                              style={{ '--color': 'white', margin: '-4px -8px 0 0' }}
                              onClick={clearSavedStreet}
                            >
                              Changer
                            </IonButton>
                          </div>
                        </div>

                        {/* Champ de saisie du numero */}
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <IonIcon icon={keypadOutline} style={{ color: 'var(--ion-color-primary)' }} />
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                              Numero
                            </span>
                            {quickNumberState === 'validating' && (
                              <IonSpinner name="crescent" style={{ width: '16px', height: '16px', marginLeft: 'auto' }} />
                            )}
                            {quickNumberState === 'valid' && (
                              <IonIcon icon={checkmarkCircle} style={{ color: '#16a34a', marginLeft: 'auto' }} />
                            )}
                          </div>

                          <IonItem style={{ '--background': 'var(--card-background)', '--border-radius': '10px' }}>
                            <IonInput
                              value={quickNumber}
                              onIonInput={(e) => handleQuickNumberInput(e.detail.value || '')}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9a-zA-Z]*"
                              placeholder="Entrez le numero (ex: 17, 12 bis)"
                              disabled={loading}
                              style={{ fontSize: '20px', fontWeight: 600, textAlign: 'center' }}
                            />
                          </IonItem>

                          {/* Resultats multiples */}
                          {quickNumberState === 'multiple' && quickNumberResults.length > 0 && (
                            <div style={{
                              marginTop: '8px',
                              background: 'var(--card-background)',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color-medium)',
                              overflow: 'hidden'
                            }}>
                              {quickNumberResults.map((feature, index) => (
                                <div
                                  key={index}
                                  onClick={() => selectQuickNumberResult(feature)}
                                  style={{
                                    padding: '12px',
                                    cursor: 'pointer',
                                    borderBottom: index < quickNumberResults.length - 1 ? '1px solid var(--border-color-medium)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                  }}
                                >
                                  <IonIcon icon={chevronForwardOutline} style={{ color: 'var(--ion-color-primary)' }} />
                                  <div>
                                    <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-primary)' }}>{feature.properties.label}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Erreur */}
                          {quickNumberState === 'not_found' && quickNumberError && (
                            <div style={{
                              marginTop: '8px',
                              padding: '10px 12px',
                              background: '#fef2f2',
                              borderRadius: '8px',
                              fontSize: '13px',
                              color: '#991b1b',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <IonIcon icon={alertCircleOutline} />
                              {quickNumberError}
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
                      </>
                    )}

                    {/* === MODE B: Recherche complete === */}
                    <div style={{ marginBottom: savedStreet ? '0' : '16px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px'
                      }}>
                        <IonIcon icon={searchOutline} style={{ color: 'var(--ion-color-primary)' }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                          {savedStreet ? 'Autre adresse' : 'Rechercher une adresse'}
                        </span>
                      </div>

                      <div style={{ position: 'relative' }}>
                        <IonItem style={{ '--background': 'var(--card-background)', '--border-radius': '8px' }}>
                          <IonInput
                            value={addressQuery}
                            onIonInput={(e) => handleAddressInput(e.detail.value || '')}
                            onIonFocus={() => addressResults.length > 0 && setShowResults(true)}
                            type="text"
                            placeholder="12 rue de la paix lyon..."
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
                                  padding: '12px 14px',
                                  cursor: 'pointer',
                                  borderBottom: index < addressResults.length - 1 ? '1px solid var(--border-color-medium)' : 'none'
                                }}
                              >
                                <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-primary)' }}>{feature.properties.label}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{feature.properties.context}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Separateur avant GPS (si pas de savedStreet) */}
                    {!savedStreet && (
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
                    )}

                    {/* === Section GPS === */}
                    <div style={{ marginTop: savedStreet ? '0' : '0' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px'
                      }}>
                        <IonIcon icon={locationOutline} style={{ color: 'var(--ion-color-success)' }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                          Detection GPS
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
                          <IonSpinner name="crescent" style={{ width: '20px', height: '20px' }} />
                          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                            Detection en cours...
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
                          <IonIcon icon={checkmarkCircle} style={{ fontSize: '22px', color: '#16a34a', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '11px', color: '#166534', marginBottom: '2px' }}>
                              Appuyez pour utiliser
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
                          <IonIcon icon={chevronForwardOutline} style={{ fontSize: '18px', color: '#16a34a' }} />
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
                          <IonIcon icon={alertCircleOutline} style={{ fontSize: '20px', color: '#dc2626', flexShrink: 0 }} />
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
