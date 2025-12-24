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
  IonFab,
  IonFabButton,
  IonModal,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonBadge,
  IonAlert,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  useIonToast
} from '@ionic/react'
import { add, pencil, trash, shieldCheckmark } from 'ionicons/icons'
import { useBinomesStore, Binome } from '@/stores/binomesStore'
import BinomeModal from '@/components/BinomeModal'

const AdminBinomes: React.FC = () => {
  const [presentToast] = useIonToast()
  const { binomes, loading, error, fetchBinomes, deleteBinome } = useBinomesStore()

  const [showModal, setShowModal] = useState(false)
  const [editingBinome, setEditingBinome] = useState<Binome | undefined>()
  const [deleteAlert, setDeleteAlert] = useState<{ isOpen: boolean; binome?: Binome }>({
    isOpen: false
  })

  useEffect(() => {
    fetchBinomes()
  }, [fetchBinomes])

  const handleRefresh = async (event: CustomEvent) => {
    await fetchBinomes()
    event.detail.complete()
  }

  const openAddModal = () => {
    setEditingBinome(undefined)
    setShowModal(true)
  }

  const openEditModal = (binome: Binome) => {
    setEditingBinome(binome)
    setShowModal(true)
  }

  const handleModalDismiss = (saved?: boolean) => {
    setShowModal(false)
    setEditingBinome(undefined)
    if (saved) {
      fetchBinomes()
    }
  }

  const confirmDelete = (binome: Binome) => {
    setDeleteAlert({ isOpen: true, binome })
  }

  const handleDelete = async () => {
    const binome = deleteAlert.binome
    if (!binome) return

    const binomeId = binome.Id || binome.id
    if (!binomeId) return

    try {
      await deleteBinome(binomeId)
      presentToast({
        message: 'Binome supprime avec succes',
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

  const isAdmin = (binome: Binome) => {
    return binome.is_admin === true || binome.is_admin === 1 || binome.is_admin === '1'
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/admin" text="Retour" />
          </IonButtons>
          <IonTitle>Gestion des Binomes</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && binomes.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : error ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ion-color-danger)' }}>
            {error}
          </div>
        ) : binomes.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ion-color-medium)' }}>
            Aucun binome enregistre
          </div>
        ) : (
          <IonList>
            {binomes.map(binome => (
              <IonItemSliding key={binome.Id || binome.id}>
                <IonItem>
                  <IonLabel>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {binome.binome_name}
                      {isAdmin(binome) && (
                        <IonBadge color="warning" style={{ fontSize: '10px' }}>
                          <IonIcon icon={shieldCheckmark} style={{ marginRight: '4px' }} />
                          Admin
                        </IonBadge>
                      )}
                    </h2>
                    <p>Utilisateur: {binome.username}</p>
                    {binome.assigned_zone && (
                      <p>Zone: {binome.assigned_zone}</p>
                    )}
                    {binome.last_login && (
                      <p style={{ fontSize: '12px', color: 'var(--ion-color-medium)' }}>
                        Derniere connexion: {new Date(binome.last_login).toLocaleString('fr-FR')}
                      </p>
                    )}
                  </IonLabel>
                  <IonButton fill="clear" onClick={() => openEditModal(binome)}>
                    <IonIcon icon={pencil} />
                  </IonButton>
                </IonItem>

                <IonItemOptions side="end">
                  <IonItemOption color="primary" onClick={() => openEditModal(binome)}>
                    <IonIcon slot="icon-only" icon={pencil} />
                  </IonItemOption>
                  <IonItemOption color="danger" onClick={() => confirmDelete(binome)}>
                    <IonIcon slot="icon-only" icon={trash} />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
          </IonList>
        )}

        {/* FAB pour ajouter */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={openAddModal}>
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        {/* Modal d'ajout/edition */}
        <IonModal isOpen={showModal} onDidDismiss={() => handleModalDismiss()}>
          <BinomeModal
            binome={editingBinome}
            onDismiss={handleModalDismiss}
          />
        </IonModal>

        {/* Alert de confirmation de suppression */}
        <IonAlert
          isOpen={deleteAlert.isOpen}
          onDidDismiss={() => setDeleteAlert({ isOpen: false })}
          header="Confirmer la suppression"
          message={`Voulez-vous vraiment supprimer le binome "${deleteAlert.binome?.binome_name}" ?`}
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

export default AdminBinomes
