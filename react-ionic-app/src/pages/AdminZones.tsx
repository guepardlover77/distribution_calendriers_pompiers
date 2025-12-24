import React, { useEffect, useState } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonAlert,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonActionSheet,
  IonModal,
  IonSelect,
  IonSelectOption,
  useIonToast
} from '@ionic/react'
import { colorPalette, person, trash } from 'ionicons/icons'
import { useZonesStore, Zone } from '@/stores/zonesStore'
import { useBinomesStore } from '@/stores/binomesStore'

const COLOR_PRESETS = [
  { name: 'Vert', value: '#10b981' },
  { name: 'Bleu', value: '#3b82f6' },
  { name: 'Orange', value: '#f59e0b' },
  { name: 'Rouge', value: '#ef4444' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Rose', value: '#ec4899' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Jaune', value: '#eab308' }
]

const AdminZones: React.FC = () => {
  const [presentToast] = useIonToast()
  const { zones, loading, error, fetchZones, updateColor, assignBinome, deleteZone } = useZonesStore()
  const { binomes, fetchBinomes } = useBinomesStore()

  const [deleteAlert, setDeleteAlert] = useState<{ isOpen: boolean; zone?: Zone }>({
    isOpen: false
  })
  const [colorSheet, setColorSheet] = useState<{ isOpen: boolean; zone?: Zone }>({
    isOpen: false
  })
  const [binomeModal, setBinomeModal] = useState<{ isOpen: boolean; zone?: Zone }>({
    isOpen: false
  })
  const [selectedBinome, setSelectedBinome] = useState<string>('')

  useEffect(() => {
    fetchZones()
    fetchBinomes()
  }, [fetchZones, fetchBinomes])

  const handleRefresh = async (event: CustomEvent) => {
    await Promise.all([fetchZones(), fetchBinomes()])
    event.detail.complete()
  }

  const openColorSheet = (zone: Zone) => {
    setColorSheet({ isOpen: true, zone })
  }

  const handleColorSelect = async (color: string) => {
    const zone = colorSheet.zone
    if (!zone) return

    const zoneId = zone.Id || zone.id
    if (!zoneId) return

    try {
      await updateColor(zoneId, color)
      presentToast({
        message: 'Couleur modifiee avec succes',
        duration: 2000,
        color: 'success',
        position: 'top'
      })
    } catch (err) {
      presentToast({
        message: (err as Error).message || 'Erreur lors de la modification',
        duration: 3000,
        color: 'danger',
        position: 'top'
      })
    }

    setColorSheet({ isOpen: false })
  }

  const openBinomeModal = (zone: Zone) => {
    setSelectedBinome(zone.binome_id || '')
    setBinomeModal({ isOpen: true, zone })
  }

  const handleBinomeAssign = async () => {
    const zone = binomeModal.zone
    if (!zone) return

    const zoneId = zone.Id || zone.id
    if (!zoneId) return

    try {
      const binome = binomes.find(b => b.username === selectedBinome)
      await assignBinome(zoneId, selectedBinome, binome?.binome_name || '')
      presentToast({
        message: selectedBinome ? 'Binome assigne avec succes' : 'Assignation retiree',
        duration: 2000,
        color: 'success',
        position: 'top'
      })
    } catch (err) {
      presentToast({
        message: (err as Error).message || 'Erreur lors de l\'assignation',
        duration: 3000,
        color: 'danger',
        position: 'top'
      })
    }

    setBinomeModal({ isOpen: false })
  }

  const confirmDelete = (zone: Zone) => {
    setDeleteAlert({ isOpen: true, zone })
  }

  const handleDelete = async () => {
    const zone = deleteAlert.zone
    if (!zone) return

    const zoneId = zone.Id || zone.id
    if (!zoneId) return

    try {
      await deleteZone(zoneId)
      presentToast({
        message: 'Zone supprimee avec succes',
        duration: 2000,
        color: 'success',
        position: 'top'
      })
    } catch (err) {
      presentToast({
        message: (err as Error).message || 'Erreur lors de la suppression',
        duration: 3000,
        color: 'danger',
        position: 'top'
      })
    }

    setDeleteAlert({ isOpen: false })
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/admin" text="Retour" />
          </IonButtons>
          <IonTitle>Gestion des Zones</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && zones.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : error ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ion-color-danger)' }}>
            {error}
          </div>
        ) : zones.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ion-color-medium)' }}>
            <p>Aucune zone enregistree</p>
            <p style={{ fontSize: '14px' }}>Les zones sont creees depuis la carte</p>
          </div>
        ) : (
          <IonList>
            {zones.map(zone => (
              <IonItemSliding key={zone.Id || zone.id}>
                <IonItem>
                  <div
                    slot="start"
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: zone.color || '#10b981',
                      border: '2px solid white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  />
                  <IonLabel>
                    <h2>{zone.name}</h2>
                    {zone.binome_name ? (
                      <p>Binome: {zone.binome_name}</p>
                    ) : (
                      <p style={{ color: 'var(--ion-color-medium)', fontStyle: 'italic' }}>
                        Aucun binome assigne
                      </p>
                    )}
                  </IonLabel>
                  <IonButton fill="clear" onClick={() => openColorSheet(zone)}>
                    <IonIcon icon={colorPalette} />
                  </IonButton>
                  <IonButton fill="clear" onClick={() => openBinomeModal(zone)}>
                    <IonIcon icon={person} />
                  </IonButton>
                </IonItem>

                <IonItemOptions side="end">
                  <IonItemOption color="primary" onClick={() => openColorSheet(zone)}>
                    <IonIcon slot="icon-only" icon={colorPalette} />
                  </IonItemOption>
                  <IonItemOption color="secondary" onClick={() => openBinomeModal(zone)}>
                    <IonIcon slot="icon-only" icon={person} />
                  </IonItemOption>
                  <IonItemOption color="danger" onClick={() => confirmDelete(zone)}>
                    <IonIcon slot="icon-only" icon={trash} />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
          </IonList>
        )}

        {/* ActionSheet pour choisir la couleur */}
        <IonActionSheet
          isOpen={colorSheet.isOpen}
          onDidDismiss={() => setColorSheet({ isOpen: false })}
          header="Choisir une couleur"
          buttons={[
            ...COLOR_PRESETS.map(color => ({
              text: color.name,
              cssClass: 'color-button',
              handler: () => handleColorSelect(color.value),
              data: { color: color.value }
            })),
            {
              text: 'Annuler',
              role: 'cancel'
            }
          ]}
        />

        {/* Modal pour assigner un binome */}
        <IonModal
          isOpen={binomeModal.isOpen}
          onDidDismiss={() => setBinomeModal({ isOpen: false })}
          initialBreakpoint={0.5}
          breakpoints={[0, 0.5, 0.75]}
        >
          <IonHeader>
            <IonToolbar>
              <IonTitle>Assigner un binome</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setBinomeModal({ isOpen: false })}>
                  Fermer
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <p style={{ marginBottom: '16px', color: 'var(--ion-color-medium)' }}>
              Zone: <strong>{binomeModal.zone?.name}</strong>
            </p>

            <IonItem style={{ '--background': 'var(--ion-color-light)', '--border-radius': '8px' }}>
              <IonSelect
                value={selectedBinome}
                onIonChange={(e) => setSelectedBinome(e.detail.value)}
                label="Binome"
                labelPlacement="floating"
                interface="action-sheet"
              >
                <IonSelectOption value="">Aucun binome</IonSelectOption>
                {binomes.map(binome => (
                  <IonSelectOption key={binome.Id || binome.id} value={binome.username}>
                    {binome.binome_name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <IonButton
              expand="block"
              className="ion-margin-top"
              onClick={handleBinomeAssign}
            >
              Confirmer
            </IonButton>
          </IonContent>
        </IonModal>

        {/* Alert de confirmation de suppression */}
        <IonAlert
          isOpen={deleteAlert.isOpen}
          onDidDismiss={() => setDeleteAlert({ isOpen: false })}
          header="Confirmer la suppression"
          message={`Voulez-vous vraiment supprimer la zone "${deleteAlert.zone?.name}" ?`}
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
