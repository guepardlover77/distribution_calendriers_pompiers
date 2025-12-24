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
import { addOutline, locateOutline, logOutOutline, brushOutline } from 'ionicons/icons'
import { Geolocation } from '@capacitor/geolocation'
import L from 'leaflet'
import 'leaflet-draw'
import { useAuthStore } from '@/stores/authStore'
import { useDistributionsStore } from '@/stores/distributionsStore'
import { useZonesStore } from '@/stores/zonesStore'
import DistributionModal from '@/components/DistributionModal'

// Import leaflet-draw CSS
import 'leaflet-draw/dist/leaflet.draw.css'

const Map: React.FC = () => {
  const history = useHistory()
  const [presentToast] = useIonToast()
  const logout = useAuthStore(state => state.logout)
  const isAdmin = useAuthStore(state => state.isAdmin)
  const currentUser = useAuthStore(state => state.currentUser)
  const fetchAll = useDistributionsStore(state => state.fetchAll)
  const filteredItems = useDistributionsStore(state => state.filteredItems)

  // Zones store
  const { zones, fetchZones, createZone, deleteZone } = useZonesStore()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const zonesLayerRef = useRef<L.FeatureGroup | null>(null)
  const drawControlRef = useRef<L.Control.Draw | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [zoneNameAlert, setZoneNameAlert] = useState<{
    isOpen: boolean
    layer?: L.Layer
    geojson?: string
  }>({ isOpen: false })

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

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19,
        minZoom: 3
      }).addTo(mapRef.current)

      // Create zones layer
      zonesLayerRef.current = new L.FeatureGroup()
      mapRef.current.addLayer(zonesLayerRef.current)

      // Handle popup clicks for zone deletion
      mapRef.current.on('popupopen', (e: L.PopupEvent) => {
        const popup = e.popup
        const container = popup.getElement()
        if (!container) return

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

      const { latitude, longitude } = position.coords
      mapRef.current?.setView([latitude, longitude], 15)

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

  const handleLogout = async () => {
    await logout()
    history.push('/login')
  }

  const handleModalDismiss = (saved?: boolean) => {
    setIsModalOpen(false)
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
        </div>

        <IonModal isOpen={isModalOpen} onDidDismiss={() => setIsModalOpen(false)}>
          <DistributionModal onDismiss={handleModalDismiss} />
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
      </IonContent>
    </IonPage>
  )
}

export default Map
