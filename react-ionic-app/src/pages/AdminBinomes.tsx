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
  IonFab,
  IonFabButton,
  IonModal,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonAlert,
  IonChip,
  IonSearchbar,
  useIonToast
} from '@ionic/react'
import { 
  add, 
  pencil, 
  trash, 
  shieldCheckmark, 
  peopleOutline,
  timeOutline,
  mapOutline,
  personCircleOutline,
  closeCircle
} from 'ionicons/icons'
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
  const [searchText, setSearchText] = useState('')

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

  const handleDelete = async () => {
    const binome = deleteAlert.binome
    if (!binome) return

    const binomeId = binome.Id || binome.id
    if (!binomeId) return

    try {
      await deleteBinome(binomeId)
      presentToast({
        message: 'Binôme supprimé',
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

  const isAdmin = (binome: Binome) => {
    return binome.is_admin === true || binome.is_admin === 1 || binome.is_admin === '1'
  }

  // Filtrer les binômes par recherche
  const filteredBinomes = binomes.filter(binome => 
    binome.binome_name.toLowerCase().includes(searchText.toLowerCase()) ||
    binome.username.toLowerCase().includes(searchText.toLowerCase()) ||
    (binome.assigned_zone && binome.assigned_zone.toLowerCase().includes(searchText.toLowerCase()))
  )

  // Statistiques
  const adminCount = binomes.filter(b => isAdmin(b)).length
  const withZoneCount = binomes.filter(b => b.assigned_zone).length

  // Obtenir les initiales pour l'avatar
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  // Générer une couleur basée sur le nom
  const getAvatarColor = (name: string) => {
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
    ]
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
    return colors[index]
  }

  // Formater la date de dernière connexion
  const formatLastLogin = (dateStr: string | undefined) => {
    if (!dateStr) return 'Jamais connecté'
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return "Aujourd'hui"
    if (days === 1) return 'Hier'
    if (days < 7) return `Il y a ${days} jours`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/admin" text="Retour" />
          </IonButtons>
          <IonTitle>Binômes</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: '16px', paddingBottom: '100px' }}>
          {/* Statistiques en haut */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '12px', 
            marginBottom: '20px' 
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: 'white',
              padding: '16px 12px',
              borderRadius: '16px',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
            }}>
              <IonIcon icon={peopleOutline} style={{ fontSize: '24px', marginBottom: '4px' }} />
              <div style={{ fontSize: '28px', fontWeight: '700' }}>{binomes.length}</div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Total</div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              padding: '16px 12px',
              borderRadius: '16px',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)'
            }}>
              <IonIcon icon={shieldCheckmark} style={{ fontSize: '24px', marginBottom: '4px' }} />
              <div style={{ fontSize: '28px', fontWeight: '700' }}>{adminCount}</div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Admins</div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              padding: '16px 12px',
              borderRadius: '16px',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
            }}>
              <IonIcon icon={mapOutline} style={{ fontSize: '24px', marginBottom: '4px' }} />
              <div style={{ fontSize: '28px', fontWeight: '700' }}>{withZoneCount}</div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Avec zone</div>
            </div>
          </div>

          {/* Barre de recherche */}
          <IonSearchbar
            value={searchText}
            onIonInput={(e) => setSearchText(e.detail.value || '')}
            placeholder="Rechercher un binôme..."
            style={{ 
              '--background': 'var(--ion-color-light)',
              '--border-radius': '12px',
              marginBottom: '16px',
              padding: 0
            }}
          />

          {loading && binomes.length === 0 ? (
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
          ) : filteredBinomes.length === 0 ? (
            <div style={{ 
              padding: '60px 20px', 
              textAlign: 'center',
              background: 'var(--ion-color-light)',
              borderRadius: '16px'
            }}>
              <IonIcon icon={personCircleOutline} style={{ fontSize: '64px', color: 'var(--ion-color-medium)', opacity: 0.5 }} />
              <p style={{ color: 'var(--ion-color-medium)', marginTop: '16px', fontSize: '16px' }}>
                {searchText ? 'Aucun binôme trouvé' : 'Aucun binôme enregistré'}
              </p>
              <IonButton 
                fill="outline" 
                style={{ marginTop: '16px', '--border-radius': '12px' }}
                onClick={openAddModal}
              >
                <IonIcon icon={add} slot="start" />
                Ajouter un binôme
              </IonButton>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredBinomes.map(binome => (
                <div
                  key={binome.Id || binome.id}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '16px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Badge admin en haut à droite */}
                  {isAdmin(binome) && (
                    <div style={{
                      position: 'absolute',
                      top: '0',
                      right: '0',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: 'white',
                      padding: '4px 12px',
                      borderBottomLeftRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <IonIcon icon={shieldCheckmark} style={{ fontSize: '12px' }} />
                      Admin
                    </div>
                  )}

                  {/* Header avec avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '16px',
                      background: getAvatarColor(binome.binome_name),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: '700',
                      fontSize: '18px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                      {getInitials(binome.binome_name)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ 
                        margin: '0 0 2px 0', 
                        fontSize: '17px', 
                        fontWeight: '600',
                        color: '#1f2937',
                        paddingRight: isAdmin(binome) ? '60px' : '0'
                      }}>
                        {binome.binome_name}
                      </h3>
                      <p style={{ 
                        margin: '0', 
                        fontSize: '14px', 
                        color: 'var(--ion-color-medium)' 
                      }}>
                        @{binome.username}
                      </p>
                    </div>
                  </div>

                  {/* Infos supplémentaires */}
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    {binome.assigned_zone ? (
                      <IonChip 
                        style={{ 
                          margin: 0,
                          '--background': 'rgba(16, 185, 129, 0.1)',
                          '--color': '#059669',
                          height: '28px'
                        }}
                      >
                        <IonIcon icon={mapOutline} style={{ marginRight: '4px', fontSize: '14px' }} />
                        {binome.assigned_zone}
                      </IonChip>
                    ) : (
                      <IonChip 
                        style={{ 
                          margin: 0,
                          '--background': 'rgba(156, 163, 175, 0.15)',
                          '--color': '#6b7280',
                          height: '28px'
                        }}
                      >
                        <IonIcon icon={mapOutline} style={{ marginRight: '4px', fontSize: '14px' }} />
                        Aucune zone
                      </IonChip>
                    )}
                    <IonChip 
                      style={{ 
                        margin: 0,
                        '--background': 'rgba(99, 102, 241, 0.1)',
                        '--color': '#6366f1',
                        height: '28px'
                      }}
                    >
                      <IonIcon icon={timeOutline} style={{ marginRight: '4px', fontSize: '14px' }} />
                      {formatLastLogin(binome.last_login)}
                    </IonChip>
                  </div>

                  {/* Actions */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px',
                    paddingTop: '12px',
                    borderTop: '1px solid #f3f4f6'
                  }}>
                    <IonButton 
                      fill="outline" 
                      size="small"
                      style={{ flex: 1, '--border-radius': '10px' }}
                      onClick={() => openEditModal(binome)}
                    >
                      <IonIcon icon={pencil} slot="start" />
                      Modifier
                    </IonButton>
                    <IonButton 
                      fill="outline" 
                      color="danger"
                      size="small"
                      style={{ '--border-radius': '10px' }}
                      onClick={() => setDeleteAlert({ isOpen: true, binome })}
                    >
                      <IonIcon icon={trash} slot="icon-only" />
                    </IonButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FAB pour ajouter */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={openAddModal} style={{ '--background': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
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
          header="Supprimer ce binôme ?"
          message={`${deleteAlert.binome?.binome_name} sera définitivement supprimé.`}
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
