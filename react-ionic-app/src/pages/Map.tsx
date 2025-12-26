import React, { useEffect, useRef, useCallback, useState } from 'react'
import { useHistory } from 'react-router-dom'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonFab,
  IonFabButton,
  IonModal,
  IonAlert,
  IonChip,
  IonLabel,
  useIonToast,
  useIonViewDidEnter,
  useIonViewWillEnter
} from '@ionic/react'
import { addOutline, locateOutline, logOutOutline, brushOutline, layersOutline, checkmarkCircle, syncOutline } from 'ionicons/icons'
import { Geolocation } from '@capacitor/geolocation'
import L from 'leaflet'
import 'leaflet-draw'
import { useAuthStore } from '@/stores/authStore'
import { useDistributionsStore } from '@/stores/distributionsStore'
import { useZonesStore } from '@/stores/zonesStore'
import { Distribution } from '@/services/storage'
import DistributionModal from '@/components/DistributionModal'

// Import leaflet-draw CSS
import 'leaflet-draw/dist/leaflet.draw.css'

// Map theme configuration
interface MapTheme {
  id: string
  name: string
  description: string
  url: string
  attribution: string
  preview: string
}

const MAP_THEMES: MapTheme[] = [
  {
    id: 'voyager',
    name: 'Voyager',
    description: 'Colore et moderne',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    preview: '#4A90E2'
  },
  {
    id: 'positron',
    name: 'Positron',
    description: 'Minimaliste clair',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    preview: '#F5F5F5'
  },
  {
    id: 'dark',
    name: 'Dark Matter',
    description: 'Sombre elegant',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    preview: '#2C3E50'
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    description: 'Classique detaille',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    preview: '#F2EFE9'
  },
  {
    id: 'terrain',
    name: 'Terrain',
    description: 'Relief naturel',
    url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png',
    attribution: '&copy; Stamen Design &copy; OpenStreetMap contributors',
    preview: '#B8D4A8'
  },
  {
    id: 'toner',
    name: 'Toner',
    description: 'Noir et blanc artistique',
    url: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png',
    attribution: '&copy; Stamen Design &copy; OpenStreetMap contributors',
    preview: '#EEEEEE'
  }
]

const THEME_STORAGE_KEY = 'pompiers_map_theme'

const Map: React.FC = () => {
  const history = useHistory()
  const [presentToast] = useIonToast()
  const logout = useAuthStore(state => state.logout)
  const isAdmin = useAuthStore(state => state.isAdmin)
  const currentUser = useAuthStore(state => state.currentUser)
  const fetchAll = useDistributionsStore(state => state.fetchAll)
  const filteredItems = useDistributionsStore(state => state.filteredItems)
  const removeDistribution = useDistributionsStore(state => state.remove)

  // Zones store
  const { zones, fetchZones, createZone, deleteZone } = useZonesStore()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const zonesLayerRef = useRef<L.FeatureGroup | null>(null)
  const drawControlRef = useRef<L.Control.Draw | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const gpsMarkerRef = useRef<L.CircleMarker | null>(null)
  const gpsAccuracyCircleRef = useRef<L.Circle | null>(null)
  const gpsWatchIdRef = useRef<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [zoneNameAlert, setZoneNameAlert] = useState<{
    isOpen: boolean
    layer?: L.Layer
    geojson?: string
  }>({ isOpen: false })
  const [selectedTheme, setSelectedTheme] = useState<string>('voyager')
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false)
  const [editingDistribution, setEditingDistribution] = useState<Distribution | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  // Demander la permission de geolocalisation
  const requestLocationPermission = async () => {
    try {
      const permission = await Geolocation.checkPermissions()
      console.log('[Map] Current permission status:', permission.location)

      if (permission.location !== 'granted') {
        const request = await Geolocation.requestPermissions()
        console.log('[Map] Permission request result:', request.location)

        if (request.location === 'granted') {
          presentToast({
            message: 'Permission de localisation accordee',
            duration: 2000,
            color: 'success',
            position: 'top'
          })
        }
      }
    } catch (error) {
      console.error('[Map] Error requesting location permission:', error)
    }
  }

  // Fix pour l'affichage de la carte - invalidateSize quand la vue est prete
  useIonViewDidEnter(() => {
    if (mapRef.current) {
      // Petit delai pour s'assurer que le conteneur a ses dimensions finales
      setTimeout(() => {
        mapRef.current?.invalidateSize()
      }, 100)
    }

    // Demander la permission de localisation
    requestLocationPermission()
  })

  useIonViewWillEnter(() => {
    // Rafraichir les donnees quand on revient sur la page
    fetchAll()
    fetchZones()
  })

  // Mettre a jour le marqueur de position GPS
  const updateGpsMarker = useCallback((latitude: number, longitude: number, accuracy?: number) => {
    if (!mapRef.current) return

    // Supprimer les anciens marqueurs GPS
    if (gpsMarkerRef.current) {
      mapRef.current.removeLayer(gpsMarkerRef.current)
    }
    if (gpsAccuracyCircleRef.current) {
      mapRef.current.removeLayer(gpsAccuracyCircleRef.current)
    }

    // Cercle de precision (si disponible)
    if (accuracy && accuracy > 0) {
      gpsAccuracyCircleRef.current = L.circle([latitude, longitude], {
        radius: accuracy,
        color: '#4285F4',
        fillColor: '#4285F4',
        fillOpacity: 0.15,
        weight: 1
      }).addTo(mapRef.current)
    }

    // Point GPS (cercle bleu avec bordure blanche)
    gpsMarkerRef.current = L.circleMarker([latitude, longitude], {
      radius: 8,
      color: '#ffffff',
      fillColor: '#4285F4',
      fillOpacity: 1,
      weight: 3
    }).addTo(mapRef.current)

    // Tooltip au survol
    gpsMarkerRef.current.bindTooltip('Ma position', { direction: 'top', offset: [0, -10] })
  }, [])

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      effectue: '#10b981',
      repasser: '#f59e0b',
      refus: '#ef4444',
      maison_vide: '#6b7280'
    }
    return colors[status] || '#9ca3af'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      effectue: 'Effectue',
      repasser: 'A repasser',
      refus: 'Refus',
      maison_vide: 'Maison vide'
    }
    return labels[status] || status
  }

  // Update distribution markers
  const updateMarkers = useCallback(() => {
    if (!mapRef.current) return

    const items = filteredItems()

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => {
      mapRef.current?.removeLayer(marker)
    })
    markersRef.current = {}

    // Add new markers
    items.forEach(dist => {
      const color = getStatusColor(dist.status)

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      })

      const marker = L.marker([dist.lat, dist.lng], { icon }).addTo(mapRef.current!)

      marker.bindPopup(`
        <div style="min-width: 200px">
          <strong>${dist.address}</strong><br>
          <span style="color: ${color}">&bull; ${getStatusLabel(dist.status)}</span>
          ${dist.amount > 0 ? `<br><strong>Montant:</strong> ${dist.amount.toFixed(2)} EUR` : ''}
          ${dist.payment_method && dist.payment_method !== 'non_specifie' ? `<br><strong>Paiement:</strong> ${dist.payment_method}` : ''}
          <div style="display: flex; gap: 8px; margin-top: 8px;">
            <button class="distribution-edit-btn" data-distribution-id="${dist.id}" style="flex: 1; padding: 6px 12px; background: var(--ion-color-primary, #3b82f6); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Modifier</button>
            <button class="distribution-delete-btn" data-distribution-id="${dist.id}" style="flex: 1; padding: 6px 12px; background: var(--ion-color-danger, #ef4444); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Supprimer</button>
          </div>
        </div>
      `)

      markersRef.current[dist.id] = marker
    })
  }, [filteredItems])

  // Update zones on map
  const updateZonesLayer = useCallback(() => {
    if (!mapRef.current || !zonesLayerRef.current) return

    // Clear existing zones
    zonesLayerRef.current.clearLayers()

    // Filter zones based on user role
    const zonesToShow = isAdmin()
      ? zones
      : zones.filter(z =>
          z.binome_id === currentUser?.username ||
          z.name === currentUser?.assigned_zone
        )

    // Add zones to map
    zonesToShow.forEach(zone => {
      if (!zone.geojson) return

      try {
        const geoJson = JSON.parse(zone.geojson)
        const layer = L.geoJSON(geoJson, {
          style: {
            color: zone.color || '#10b981',
            weight: 2,
            opacity: 0.8,
            fillColor: zone.color || '#10b981',
            fillOpacity: 0.2
          }
        })

        // Add popup with zone info
        layer.bindPopup(`
          <div style="min-width: 150px">
            <strong>${zone.name}</strong>
            ${zone.binome_name ? `<br><small>Binome: ${zone.binome_name}</small>` : ''}
            ${isAdmin() ? `<br><button class="zone-delete-btn" data-zone-id="${zone.Id || zone.id}">Supprimer</button>` : ''}
          </div>
        `)

        // Store zone ID on layer for later reference
        ;(layer as L.GeoJSON & { zoneId?: string }).zoneId = zone.Id || zone.id

        zonesLayerRef.current?.addLayer(layer)
      } catch (e) {
        console.error('Error parsing zone geojson:', e)
      }
    })
  }, [zones, isAdmin, currentUser])

  // Initialize map
  useEffect(() => {
    fetchAll()
    fetchZones()
  }, [fetchAll, fetchZones])

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      // Create map
      mapRef.current = L.map(mapContainerRef.current).setView([46.603354, 1.888334], 6)

      // Charger le thème sauvegardé ou utiliser Voyager par défaut
      const savedThemeId = localStorage.getItem(THEME_STORAGE_KEY) || 'voyager'
      setSelectedTheme(savedThemeId)
      const theme = MAP_THEMES.find(t => t.id === savedThemeId) || MAP_THEMES[0]

      tileLayerRef.current = L.tileLayer(theme.url, {
        attribution: theme.attribution,
        maxZoom: 19,
        minZoom: 3
      }).addTo(mapRef.current)

      // Create zones layer
      zonesLayerRef.current = new L.FeatureGroup()
      mapRef.current.addLayer(zonesLayerRef.current)

      // Handle popup clicks for zone deletion and distribution editing
      mapRef.current.on('popupopen', (e: L.PopupEvent) => {
        const popup = e.popup
        const container = popup.getElement()
        if (!container) return

        // Handler pour suppression de zone
        const deleteBtn = container.querySelector('.zone-delete-btn')
        if (deleteBtn) {
          deleteBtn.addEventListener('click', async (evt) => {
            const zoneId = (evt.target as HTMLElement).getAttribute('data-zone-id')
            if (zoneId) {
              try {
                await deleteZone(zoneId)
                presentToast({
                  message: 'Zone supprimee',
                  duration: 2000,
                  color: 'success',
                  position: 'top'
                })
                updateZonesLayer()
              } catch {
                presentToast({
                  message: 'Erreur lors de la suppression',
                  duration: 2000,
                  color: 'danger',
                  position: 'top'
                })
              }
            }
            mapRef.current?.closePopup()
          })
        }

        // Handler pour modification de distribution
        const editBtn = container.querySelector('.distribution-edit-btn')
        if (editBtn) {
          editBtn.addEventListener('click', (evt) => {
            const distributionId = (evt.target as HTMLElement).getAttribute('data-distribution-id')
            if (distributionId) {
              const items = filteredItems()
              const distribution = items.find(d => d.id === distributionId)
              if (distribution) {
                setEditingDistribution(distribution)
                setIsModalOpen(true)
                mapRef.current?.closePopup()
              }
            }
          })
        }

        // Handler pour suppression de distribution
        const distDeleteBtn = container.querySelector('.distribution-delete-btn')
        if (distDeleteBtn) {
          distDeleteBtn.addEventListener('click', async (evt) => {
            const distributionId = (evt.target as HTMLElement).getAttribute('data-distribution-id')
            if (distributionId) {
              const items = filteredItems()
              const distribution = items.find(d => d.id === distributionId)
              if (distribution) {
                if (confirm(`Supprimer la distribution a l'adresse "${distribution.address}" ?`)) {
                  try {
                    await removeDistribution(distributionId)
                    presentToast({
                      message: 'Distribution supprimee',
                      duration: 2000,
                      color: 'success',
                      position: 'top'
                    })
                    mapRef.current?.closePopup()
                    updateMarkers()
                  } catch {
                    presentToast({
                      message: 'Erreur lors de la suppression',
                      duration: 2000,
                      color: 'danger',
                      position: 'top'
                    })
                  }
                }
              }
            }
          })
        }
      })

      // Initial updates
      updateMarkers()
      updateZonesLayer()

      // Fix pour l'affichage initial - forcer le recalcul des dimensions
      setTimeout(() => {
        mapRef.current?.invalidateSize()
      }, 200)

      // Second appel apres un delai plus long pour les cas ou le conteneur met du temps
      setTimeout(() => {
        mapRef.current?.invalidateSize()
      }, 500)
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Centrer automatiquement sur la position de l'utilisateur au premier chargement
  // et demarrer le suivi GPS
  useEffect(() => {
    const initializeLocation = async () => {
      if (mapRef.current) {
        try {
          // Verifier/demander la permission
          const permission = await Geolocation.checkPermissions()
          if (permission.location !== 'granted') {
            const request = await Geolocation.requestPermissions()
            if (request.location !== 'granted') {
              return
            }
          }

          // Obtenir la position initiale
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000
          })

          const { latitude, longitude, accuracy } = position.coords
          mapRef.current?.setView([latitude, longitude], 15)
          updateGpsMarker(latitude, longitude, accuracy)

          // Demarrer le suivi continu de la position
          const watchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true },
            (pos, err) => {
              if (pos && !err) {
                updateGpsMarker(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
              }
            }
          )
          gpsWatchIdRef.current = watchId
        } catch (error) {
          // En cas d'erreur, garder la vue par defaut
          console.log('Geolocalisation non disponible:', error)
        }
      }
    }

    // Attendre que la carte soit bien initialisee
    const timer = setTimeout(() => {
      initializeLocation()
    }, 800)

    return () => {
      clearTimeout(timer)
      // Arreter le suivi GPS au demontage
      if (gpsWatchIdRef.current) {
        Geolocation.clearWatch({ id: gpsWatchIdRef.current })
      }
    }
  }, [updateGpsMarker])

  // Update markers when distributions change
  useEffect(() => {
    updateMarkers()
  }, [updateMarkers])

  // Update zones layer when zones change
  useEffect(() => {
    updateZonesLayer()
  }, [updateZonesLayer])

  // Setup draw controls for admin
  useEffect(() => {
    if (!mapRef.current || !zonesLayerRef.current) return

    // Only setup draw controls for admins
    if (!isAdmin()) {
      if (drawControlRef.current) {
        mapRef.current.removeControl(drawControlRef.current)
        drawControlRef.current = null
      }
      return
    }

    // Add draw control if not present and draw mode is active
    if (drawMode && !drawControlRef.current) {
      drawControlRef.current = new L.Control.Draw({
        position: 'topright',
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: false,
            showLength: false,
            shapeOptions: {
              color: '#10b981',
              fillColor: '#10b981',
              fillOpacity: 0.2
            }
          },
          rectangle: {
            showArea: false,
            shapeOptions: {
              color: '#10b981',
              fillColor: '#10b981',
              fillOpacity: 0.2
            }
          },
          circle: false,
          circlemarker: false,
          marker: false,
          polyline: false
        },
        edit: {
          featureGroup: zonesLayerRef.current,
          remove: true
        }
      })

      mapRef.current.addControl(drawControlRef.current)

      // Handle draw created event
      mapRef.current.on(L.Draw.Event.CREATED, (e: L.LeafletEvent) => {
        const event = e as L.DrawEvents.Created
        const layer = event.layer
        const geoJson = (layer as L.Polygon).toGeoJSON()

        setZoneNameAlert({
          isOpen: true,
          layer,
          geojson: JSON.stringify(geoJson.geometry)
        })
      })

    } else if (!drawMode && drawControlRef.current) {
      mapRef.current.removeControl(drawControlRef.current)
      drawControlRef.current = null

      // Remove draw event listeners
      mapRef.current.off(L.Draw.Event.CREATED)
    }
  }, [drawMode, isAdmin])

  // Handle zone name submission
  const handleZoneNameSubmit = async (zoneName: string) => {
    if (!zoneName.trim()) {
      presentToast({
        message: 'Veuillez entrer un nom pour la zone',
        duration: 2000,
        color: 'warning',
        position: 'top'
      })
      return
    }

    if (!zoneNameAlert.geojson) {
      presentToast({
        message: 'Erreur: geometrie de zone manquante',
        duration: 2000,
        color: 'danger',
        position: 'top'
      })
      setZoneNameAlert({ isOpen: false })
      return
    }

    try {
      console.log('[Zone] Creating zone with data:', {
        name: zoneName.trim(),
        geojson: zoneNameAlert.geojson,
        color: '#10b981'
      })

      const newZone = await createZone({
        name: zoneName.trim(),
        geojson: zoneNameAlert.geojson,
        color: '#10b981'
      })

      console.log('[Zone] Zone created:', newZone)

      presentToast({
        message: 'Zone creee avec succes',
        duration: 2000,
        color: 'success',
        position: 'top'
      })

      // Refresh zones from server
      await fetchZones()

    } catch (error) {
      console.error('[Zone] Error creating zone:', error)
      presentToast({
        message: `Erreur: ${(error as Error).message || 'Impossible de creer la zone'}`,
        duration: 3000,
        color: 'danger',
        position: 'top'
      })
    }

    setZoneNameAlert({ isOpen: false })
  }

  const centerOnLocation = async () => {
    try {
      // Verifier/demander la permission d'abord
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

      // Obtenir la position
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      })

      const { latitude, longitude, accuracy } = position.coords
      mapRef.current?.setView([latitude, longitude], 15)
      updateGpsMarker(latitude, longitude, accuracy)

      presentToast({
        message: 'Position obtenue',
        duration: 2000,
        color: 'success',
        position: 'top'
      })

    } catch (error) {
      console.error('[Map] Geolocation error:', error)
      presentToast({
        message: 'Impossible d\'obtenir votre position',
        duration: 2000,
        color: 'danger',
        position: 'top'
      })
    }
  }

  const handleSync = async () => {
    if (isSyncing) return

    setIsSyncing(true)
    try {
      await Promise.all([fetchAll(), fetchZones()])
      presentToast({
        message: 'Synchronisation terminee',
        duration: 2000,
        color: 'success',
        position: 'top'
      })
    } catch (error) {
      console.error('[Map] Sync error:', error)
      presentToast({
        message: 'Erreur de synchronisation',
        duration: 2000,
        color: 'danger',
        position: 'top'
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const changeMapTheme = useCallback((themeId: string) => {
    const theme = MAP_THEMES.find(t => t.id === themeId)
    if (!theme || !mapRef.current) return

    // Retirer l'ancienne tileLayer
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current)
    }

    // Ajouter la nouvelle tileLayer
    tileLayerRef.current = L.tileLayer(theme.url, {
      attribution: theme.attribution,
      maxZoom: 19,
      minZoom: 3
    }).addTo(mapRef.current)

    // Sauvegarder la préférence
    localStorage.setItem(THEME_STORAGE_KEY, themeId)
    setSelectedTheme(themeId)
    setIsThemeModalOpen(false)

    presentToast({
      message: `Theme ${theme.name} applique`,
      duration: 2000,
      color: 'success',
      position: 'top'
    })
  }, [presentToast])

  const handleLogout = async () => {
    await logout()
    history.push('/login')
  }

  const handleModalDismiss = (saved?: boolean) => {
    setIsModalOpen(false)
    setEditingDistribution(null)
    if (saved) {
      updateMarkers()
    }
  }

  const toggleDrawMode = () => {
    setDrawMode(prev => !prev)
    if (!drawMode) {
      presentToast({
        message: 'Mode dessin active. Utilisez les outils pour creer une zone.',
        duration: 3000,
        color: 'primary',
        position: 'top'
      })
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Carte</IonTitle>
          <IonButtons slot="start">
            {isAdmin() && (
              <IonChip
                color={drawMode ? 'success' : 'medium'}
                onClick={toggleDrawMode}
                style={{ marginLeft: '8px' }}
              >
                <IonIcon icon={brushOutline} />
                <IonLabel>{drawMode ? 'Dessin ON' : 'Dessiner zones'}</IonLabel>
              </IonChip>
            )}
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={() => setIsThemeModalOpen(true)}>
              <IonIcon slot="icon-only" icon={layersOutline} />
            </IonButton>
            <IonButton onClick={handleLogout}>
              <IonIcon slot="icon-only" icon={logOutOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="map-container">
          <div id="map" ref={mapContainerRef} />

          <IonFab vertical="bottom" horizontal="end" slot="fixed" className="map-fab">
            <IonFabButton onClick={() => setIsModalOpen(true)}>
              <IonIcon icon={addOutline} />
            </IonFabButton>
          </IonFab>

          <IonFab vertical="bottom" horizontal="start" slot="fixed" style={{ bottom: '100px' }}>
            <IonFabButton size="small" onClick={centerOnLocation} color="light">
              <IonIcon icon={locateOutline} />
            </IonFabButton>
          </IonFab>

          <IonFab vertical="bottom" horizontal="start" slot="fixed" style={{ bottom: '160px' }}>
            <IonFabButton size="small" onClick={handleSync} color="light" disabled={isSyncing}>
              <IonIcon icon={syncOutline} className={isSyncing ? 'spin-animation' : ''} />
            </IonFabButton>
          </IonFab>
        </div>

        <IonModal isOpen={isModalOpen} onDidDismiss={() => handleModalDismiss(false)}>
          <DistributionModal
            distribution={editingDistribution || undefined}
            onDismiss={handleModalDismiss}
          />
        </IonModal>

        {/* Alert for zone name */}
        <IonAlert
          isOpen={zoneNameAlert.isOpen}
          onDidDismiss={() => setZoneNameAlert({ isOpen: false })}
          header="Nom de la zone"
          message="Entrez un nom pour cette nouvelle zone"
          inputs={[
            {
              name: 'zoneName',
              type: 'text',
              placeholder: 'Ex: Secteur Centre-Ville'
            }
          ]}
          buttons={[
            {
              text: 'Annuler',
              role: 'cancel'
            },
            {
              text: 'Creer',
              handler: (data) => {
                handleZoneNameSubmit(data.zoneName)
              }
            }
          ]}
        />

        {/* Theme selector modal */}
        <IonModal isOpen={isThemeModalOpen} onDidDismiss={() => setIsThemeModalOpen(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Choisir un theme de carte</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setIsThemeModalOpen(false)}>Fermer</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <div style={{ padding: '16px' }}>
              {MAP_THEMES.map(theme => (
                <div
                  key={theme.id}
                  onClick={() => changeMapTheme(theme.id)}
                  style={{
                    padding: '16px',
                    marginBottom: '12px',
                    border: selectedTheme === theme.id ? '2px solid var(--ion-color-primary)' : '1px solid #ddd',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedTheme === theme.id ? 'var(--ion-color-primary-tint)' : 'white'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '8px',
                        backgroundColor: theme.preview,
                        border: '1px solid #ccc'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                        {theme.name}
                      </h3>
                      <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                        {theme.description}
                      </p>
                    </div>
                    {selectedTheme === theme.id && (
                      <IonIcon icon={checkmarkCircle} color="primary" style={{ fontSize: '24px' }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  )
}

export default Map
