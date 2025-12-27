import React, { useState } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonList,
  IonItem,
  IonBadge,
  IonChip,
  IonIcon,
  IonFab,
  IonFabButton,
  IonModal,
  IonActionSheet,
  IonAlert,
  useIonToast
} from '@ionic/react'
import { addOutline, documentTextOutline, createOutline, trashOutline, closeOutline } from 'ionicons/icons'
import { useDistributionsStore } from '@/stores/distributionsStore'
import { Distribution } from '@/services/storage'
import DistributionModal from '@/components/DistributionModal'

const List: React.FC = () => {
  const [presentToast] = useIonToast()
  const filteredItems = useDistributionsStore(state => state.filteredItems)
  const stats = useDistributionsStore(state => state.stats)
  const setFilter = useDistributionsStore(state => state.setFilter)
  const removeDistribution = useDistributionsStore(state => state.remove)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDistribution, setEditingDistribution] = useState<Distribution | null>(null)
  const [selectedDistribution, setSelectedDistribution] = useState<Distribution | null>(null)
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false)
  const [deleteConfirmAlert, setDeleteConfirmAlert] = useState<{
    isOpen: boolean
    distribution?: Distribution
  }>({ isOpen: false })

  const items = filteredItems()
  const currentStats = stats()

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'success' | 'warning' | 'danger' | 'medium' | 'tertiary'> = {
      effectue: 'success',
      repasser: 'warning',
      refus: 'danger',
      maison_vide: 'medium'
    }
    return colors[status] || 'tertiary'
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

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    setFilter('searchQuery', value)
  }

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value)
    setFilter('status', value)
  }

  const handleDistributionClick = (dist: Distribution) => {
    setSelectedDistribution(dist)
    setIsActionSheetOpen(true)
  }

  const handleEdit = () => {
    if (selectedDistribution) {
      setEditingDistribution(selectedDistribution)
      setIsModalOpen(true)
    }
    setIsActionSheetOpen(false)
  }

  const handleDelete = () => {
    if (selectedDistribution) {
      setDeleteConfirmAlert({
        isOpen: true,
        distribution: selectedDistribution
      })
    }
    setIsActionSheetOpen(false)
  }

  const confirmDelete = async () => {
    if (deleteConfirmAlert.distribution) {
      try {
        await removeDistribution(deleteConfirmAlert.distribution.id)
        presentToast({
          message: 'Distribution supprimee avec succes',
          duration: 2000,
          color: 'success',
          position: 'top'
        })
      } catch (error) {
        console.error('Error deleting distribution:', error)
        presentToast({
          message: 'Erreur lors de la suppression',
          duration: 2000,
          color: 'danger',
          position: 'top'
        })
      }
    }
    setDeleteConfirmAlert({ isOpen: false })
  }

  const handleModalDismiss = (saved?: boolean) => {
    setIsModalOpen(false)
    setEditingDistribution(null)
    if (saved) {
      presentToast({
        message: 'Distribution mise a jour',
        duration: 2000,
        color: 'success',
        position: 'top'
      })
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Liste</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Filters */}
        <div style={{ padding: '8px', background: 'var(--ion-color-light)' }}>
          <IonSearchbar
            value={searchQuery}
            placeholder="Rechercher une adresse..."
            onIonInput={(e) => handleSearch(e.detail.value || '')}
          />

          <IonSegment value={selectedStatus} onIonChange={(e) => handleStatusChange(e.detail.value as string)} scrollable>
            <IonSegmentButton value="all">
              <IonLabel>Toutes</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="effectue">
              <IonLabel>Effectue</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="repasser">
              <IonLabel>A repasser</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="refus">
              <IonLabel>Refus</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="maison_vide">
              <IonLabel>Vide</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

        {/* Quick stats */}
        <div className="quick-stats">
          <IonChip color="primary">
            <IonLabel>{currentStats.total} total</IonLabel>
          </IonChip>
          <IonChip color="success">
            <IonLabel>{currentStats.effectue} effectues</IonLabel>
          </IonChip>
          <IonChip color="warning">
            <IonLabel>{currentStats.repasser} a repasser</IonLabel>
          </IonChip>
          <IonChip color="danger">
            <IonLabel>{currentStats.refus} refus</IonLabel>
          </IonChip>
        </div>

        {/* List */}
        {items.length > 0 ? (
          <IonList>
            {items.map(dist => (
              <IonItem
                key={dist.id}
                className={`distribution-item ${dist.status}`}
                button
                onClick={() => handleDistributionClick(dist)}
              >
                <IonLabel>
                  <h2>{dist.address}</h2>
                  {dist.amount > 0 && <p>{dist.amount.toFixed(2)} EUR</p>}
                  {dist.notes && <p>{dist.notes}</p>}
                </IonLabel>
                <IonBadge color={getStatusColor(dist.status)} slot="end">
                  {getStatusLabel(dist.status)}
                </IonBadge>
              </IonItem>
            ))}
          </IonList>
        ) : (
          <div className="empty-state">
            <IonIcon icon={documentTextOutline} />
            <p>Aucune distribution trouvee</p>
          </div>
        )}

        {/* FAB */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => setIsModalOpen(true)}>
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>

        <IonModal isOpen={isModalOpen} onDidDismiss={() => handleModalDismiss(false)}>
          <DistributionModal
            distribution={editingDistribution || undefined}
            onDismiss={handleModalDismiss}
          />
        </IonModal>

        {/* Action Sheet for distribution options */}
        <IonActionSheet
          isOpen={isActionSheetOpen}
          onDidDismiss={() => setIsActionSheetOpen(false)}
          header={selectedDistribution?.address}
          buttons={[
            {
              text: 'Modifier',
              icon: createOutline,
              handler: handleEdit
            },
            {
              text: 'Supprimer',
              role: 'destructive',
              icon: trashOutline,
              handler: handleDelete
            },
            {
              text: 'Annuler',
              role: 'cancel',
              icon: closeOutline
            }
          ]}
        />

        {/* Alert for distribution deletion confirmation */}
        <IonAlert
          isOpen={deleteConfirmAlert.isOpen}
          onDidDismiss={() => setDeleteConfirmAlert({ isOpen: false })}
          header="Confirmer la suppression"
          message={`Voulez-vous vraiment supprimer la distribution a l'adresse "${deleteConfirmAlert.distribution?.address}" ?`}
          buttons={[
            {
              text: 'Annuler',
              role: 'cancel'
            },
            {
              text: 'Supprimer',
              role: 'destructive',
              handler: confirmDelete
            }
          ]}
        />
      </IonContent>
    </IonPage>
  )
}

export default List
