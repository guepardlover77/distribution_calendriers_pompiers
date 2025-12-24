import React, { useEffect, useState } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonAlert,
  IonModal,
  IonChip,
  IonSearchbar,
  useIonToast
} from '@ionic/react'
import { 
  colorPalette, 
  personAdd, 
  trash, 
  mapOutline,
  checkmarkCircle,
  closeCircle,
  peopleOutline
} from 'ionicons/icons'
import { useZonesStore, Zone } from '@/stores/zonesStore'
import { useBinomesStore, Binome } from '@/stores/binomesStore'

const COLOR_PRESETS = [
  { name: 'Vert', value: '#10b981' },
  { name: 'Bleu', value: '#3b82f6' },
  { name: 'Orange', value: '#f59e0b' },
  { name: 'Rouge', value: '#ef4444' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Rose', value: '#ec4899' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Jaune', value: '#eab308' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Ambre', value: '#f59e0b' }
]

const AdminZones: React.FC = () => {
  const [presentToast] = useIonToast()
  const { zones, loading, error, fetchZones, updateColor, assignBinome, deleteZone } = useZonesStore()
  const { binomes, fetchBinomes } = useBinomesStore()

  const [deleteAlert, setDeleteAlert] = useState<{ isOpen: boolean; zone?: Zone }>({
    isOpen: false
  })
  const [colorModal, setColorModal] = useState<{ isOpen: boolean; zone?: Zone }>({
    isOpen: false
  })
  const [binomeModal, setBinomeModal] = useState<{ isOpen: boolean; zone?: Zone }>({
    isOpen: false
  })
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    fetchZones()
    fetchBinomes()
  }, [fetchZones, fetchBinomes])

  const handleRefresh = async (event: CustomEvent) => {
    await Promise.all([fetchZones(), fetchBinomes()])
    event.detail.complete()
  }

  const handleColorSelect = async (zone: Zone, color: string) => {
    const zoneId = zone.Id || zone.id
    if (!zoneId) return

    try {
      await updateColor(zoneId, color)
      presentToast({
        message: 'Couleur mise à jour',
        duration: 1500,
        color: 'success',
        position: 'top'
      })
    } catch (err) {
      presentToast({
        message: (err as Error).message || 'Erreur',
        duration: 3000,
        color: 'danger',
        position: 'top'
      })
    }
    setColorModal({ isOpen: false })
  }

  const handleBinomeAssign = async (zone: Zone, binome: Binome | null) => {
    const zoneId = zone.Id || zone.id
    if (!zoneId) return

    try {
      await assignBinome(zoneId, binome?.username || '', binome?.binome_name || '')
      presentToast({
        message: binome ? `${binome.binome_name} assigné` : 'Binôme retiré',
        duration: 1500,
        color: 'success',
        position: 'top'
      })
    } catch (err) {
      presentToast({
        message: (err as Error).message || 'Erreur',
        duration: 3000,
        color: 'danger',
        position: 'top'
      })
    }
    setBinomeModal({ isOpen: false })
  }

  const handleDelete = async () => {
    const zone = deleteAlert.zone
    if (!zone) return

    const zoneId = zone.Id || zone.id
    if (!zoneId) return

    try {
      await deleteZone(zoneId)
      presentToast({
        message: 'Zone supprimée',
        duration: 2000,
        color: 'success',
        position: 'top'
      })
    } catch (err) {
      presentToast({
        message: (err as Error).message || 'Erreur',
        duration: 3000,
        color: 'danger',
        position: 'top'
      })
    }
    setDeleteAlert({ isOpen: false })
  }

  // Filtrer les zones par recherche
  const filteredZones = zones.filter(zone => 
    zone.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (zone.binome_name && zone.binome_name.toLowerCase().includes(searchText.toLowerCase()))
  )

  // Statistiques
  const zonesWithBinome = zones.filter(z => z.binome_id).length
  const zonesWithoutBinome = zones.length - zonesWithBinome

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/admin" text="Retour" />
          </IonButtons>
          <IonTitle>Zones</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: '16px' }}>
          {/* Statistiques en haut */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '12px', 
            marginBottom: '20px' 
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              padding: '16px 12px',
              borderRadius: '16px',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
            }}>
              <IonIcon icon={mapOutline} style={{ fontSize: '24px', marginBottom: '4px' }} />
              <div style={{ fontSize: '28px', fontWeight: '700' }}>{zones.length}</div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Total zones</div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              padding: '16px 12px',
              borderRadius: '16px',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
            }}>
              <IonIcon icon={checkmarkCircle} style={{ fontSize: '24px', marginBottom: '4px' }} />
              <div style={{ fontSize: '28px', fontWeight: '700' }}>{zonesWithBinome}</div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Assignées</div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              padding: '16px 12px',
              borderRadius: '16px',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)'
            }}>
              <IonIcon icon={closeCircle} style={{ fontSize: '24px', marginBottom: '4px' }} />
              <div style={{ fontSize: '28px', fontWeight: '700' }}>{zonesWithoutBinome}</div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Non assignées</div>
            </div>
          </div>

          {/* Barre de recherche */}
          <IonSearchbar
            value={searchText}
            onIonInput={(e) => setSearchText(e.detail.value || '')}
            placeholder="Rechercher une zone..."
            style={{ 
              '--background': 'var(--ion-color-light)',
              '--border-radius': '12px',
              marginBottom: '16px',
              padding: 0
            }}
          />

          {loading && zones.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <IonSpinner name="crescent" style={{ transform: 'scale(1.5)' }} />
            </div>
          ) : error ? (
            <div style={{ 
              padding: '40px 20px', 
              textAlign: 'center', 
              background: 'var(--ion-color-danger-tint)',
              borderRadius: '16px'
            }}>
              <IonIcon icon={closeCircle} style={{ fontSize: '48px', color: 'var(--ion-color-danger)' }} />
              <p style={{ color: 'var(--ion-color-danger)', marginTop: '12px' }}>{error}</p>
            </div>
          ) : filteredZones.length === 0 ? (
            <div style={{ 
              padding: '60px 20px', 
              textAlign: 'center',
              background: 'var(--ion-color-light)',
              borderRadius: '16px'
            }}>
              <IonIcon icon={mapOutline} style={{ fontSize: '64px', color: 'var(--ion-color-medium)', opacity: 0.5 }} />
              <p style={{ color: 'var(--ion-color-medium)', marginTop: '16px', fontSize: '16px' }}>
                {searchText ? 'Aucune zone trouvée' : 'Aucune zone enregistrée'}
              </p>
              <p style={{ fontSize: '14px', color: 'var(--ion-color-medium)', opacity: 0.7 }}>
                Les zones sont créées depuis la carte
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredZones.map(zone => (
                <div
                  key={zone.Id || zone.id}
                  style={{
                    background: 'var(--card-background)',
                    borderRadius: '16px',
                    padding: '16px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    borderLeft: `5px solid ${zone.color || '#10b981'}`,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Header de la carte */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{
                        margin: '0 0 4px 0',
                        fontSize: '18px',
                        fontWeight: '600',
                        color: 'var(--text-primary)'
                      }}>
                        {zone.name}
                      </h3>
                      {zone.binome_name ? (
                        <IonChip 
                          color="success" 
                          style={{ 
                            margin: '4px 0 0 0',
                            '--background': 'rgba(16, 185, 129, 0.1)',
                            '--color': '#059669',
                            height: '28px'
                          }}
                        >
                          <IonIcon icon={peopleOutline} style={{ marginRight: '4px' }} />
                          {zone.binome_name}
                        </IonChip>
                      ) : (
                        <IonChip 
                          color="warning"
                          style={{ 
                            margin: '4px 0 0 0',
                            '--background': 'rgba(245, 158, 11, 0.1)',
                            '--color': '#d97706',
                            height: '28px'
                          }}
                        >
                          <IonIcon icon={personAdd} style={{ marginRight: '4px' }} />
                          Non assignée
                        </IonChip>
                      )}
                    </div>
                    
                    {/* Indicateur de couleur */}
                    <div
                      onClick={() => setColorModal({ isOpen: true, zone })}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        backgroundColor: zone.color || '#10b981',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.2s'
                      }}
                    >
                      <IonIcon icon={colorPalette} style={{ color: 'white', fontSize: '20px' }} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-color)'
                  }}>
                    <IonButton 
                      fill="outline" 
                      size="small"
                      style={{ flex: 1, '--border-radius': '10px' }}
                      onClick={() => setBinomeModal({ isOpen: true, zone })}
                    >
                      <IonIcon icon={personAdd} slot="start" />
                      {zone.binome_id ? 'Changer' : 'Assigner'}
                    </IonButton>
                    <IonButton 
                      fill="outline" 
                      color="danger"
                      size="small"
                      style={{ '--border-radius': '10px' }}
                      onClick={() => setDeleteAlert({ isOpen: true, zone })}
                    >
                      <IonIcon icon={trash} slot="icon-only" />
                    </IonButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal sélection de couleur */}
        <IonModal
          isOpen={colorModal.isOpen}
          onDidDismiss={() => setColorModal({ isOpen: false })}
          initialBreakpoint={0.5}
          breakpoints={[0, 0.5]}
        >
          <div style={{ padding: '24px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600' }}>
              Couleur de la zone
            </h2>
            <p style={{ margin: '0 0 20px 0', color: 'var(--ion-color-medium)', fontSize: '14px' }}>
              {colorModal.zone?.name}
            </p>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: '12px' 
            }}>
              {COLOR_PRESETS.map(color => (
                <div
                  key={color.value}
                  onClick={() => colorModal.zone && handleColorSelect(colorModal.zone, color.value)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: '16px',
                    backgroundColor: color.value,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: colorModal.zone?.color === color.value 
                      ? `0 0 0 3px white, 0 0 0 5px ${color.value}` 
                      : '0 2px 8px rgba(0,0,0,0.15)',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                >
                  {colorModal.zone?.color === color.value && (
                    <IonIcon icon={checkmarkCircle} style={{ color: 'white', fontSize: '28px' }} />
                  )}
                </div>
              ))}
            </div>

            <IonButton
              expand="block"
              fill="outline"
              style={{ marginTop: '24px', '--border-radius': '12px' }}
              onClick={() => setColorModal({ isOpen: false })}
            >
              Annuler
            </IonButton>
          </div>
        </IonModal>

        {/* Modal assignation binôme */}
        <IonModal
          isOpen={binomeModal.isOpen}
          onDidDismiss={() => setBinomeModal({ isOpen: false })}
          initialBreakpoint={0.75}
          breakpoints={[0, 0.5, 0.75]}
        >
          <div style={{ padding: '24px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600' }}>
              Assigner un binôme
            </h2>
            <p style={{ margin: '0 0 20px 0', color: 'var(--ion-color-medium)', fontSize: '14px' }}>
              Zone: <strong>{binomeModal.zone?.name}</strong>
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Option pour retirer le binôme */}
              {binomeModal.zone?.binome_id && (
                <div
                  onClick={() => binomeModal.zone && handleBinomeAssign(binomeModal.zone, null)}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'var(--ion-color-danger-tint)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: '2px solid var(--ion-color-danger)'
                  }}
                >
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'var(--ion-color-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <IonIcon icon={closeCircle} style={{ color: 'white', fontSize: '24px' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--ion-color-danger)' }}>
                      Retirer le binôme
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--ion-color-danger)', opacity: 0.8 }}>
                      Actuellement: {binomeModal.zone?.binome_name}
                    </div>
                  </div>
                </div>
              )}

              {/* Liste des binômes */}
              {binomes.map(binome => {
                const isSelected = binomeModal.zone?.binome_id === binome.username
                return (
                  <div
                    key={binome.Id || binome.id}
                    onClick={() => binomeModal.zone && handleBinomeAssign(binomeModal.zone, binome)}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: isSelected ? 'var(--ion-color-primary-tint)' : 'var(--ion-color-light)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      border: isSelected ? '2px solid var(--ion-color-primary)' : '2px solid transparent',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: isSelected 
                        ? 'var(--ion-color-primary)' 
                        : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '16px'
                    }}>
                      {binome.binome_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        {binome.binome_name}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--ion-color-medium)' }}>
                        @{binome.username}
                      </div>
                    </div>
                    {isSelected && (
                      <IonIcon icon={checkmarkCircle} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
                    )}
                  </div>
                )
              })}

              {binomes.length === 0 && (
                <div style={{ 
                  padding: '32px', 
                  textAlign: 'center', 
                  color: 'var(--ion-color-medium)' 
                }}>
                  Aucun binôme disponible
                </div>
              )}
            </div>

            <IonButton
              expand="block"
              fill="outline"
              style={{ marginTop: '24px', '--border-radius': '12px' }}
              onClick={() => setBinomeModal({ isOpen: false })}
            >
              Annuler
            </IonButton>
          </div>
        </IonModal>

        {/* Alert de confirmation de suppression */}
        <IonAlert
          isOpen={deleteAlert.isOpen}
          onDidDismiss={() => setDeleteAlert({ isOpen: false })}
          header="Supprimer la zone ?"
          message={`La zone "${deleteAlert.zone?.name}" sera définitivement supprimée.`}
          buttons={[
            {
              text: 'Annuler',
              role: 'cancel'
            },
            {
              text: 'Supprimer',
              role: 'destructive',
              handler: handleDelete
            }
          ]}
        />
      </IonContent>
    </IonPage>
  )
}

export default AdminZones
