import React, { useEffect } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonBadge,
  IonSpinner
} from '@ionic/react'
import {
  peopleOutline,
  mapOutline,
  statsChartOutline,
  chevronForward
} from 'ionicons/icons'
import { useAuthStore } from '@/stores/authStore'
import { useBinomesStore } from '@/stores/binomesStore'
import { useZonesStore } from '@/stores/zonesStore'
import { useDistributionsStore } from '@/stores/distributionsStore'
import { Distribution } from '@/services/storage'

const Admin: React.FC = () => {
  const currentUser = useAuthStore(state => state.currentUser)
  const { binomes, fetchBinomes, loading: loadingBinomes } = useBinomesStore()
  const { zones, fetchZones, loading: loadingZones } = useZonesStore()
  const distributions = useDistributionsStore(state => state.items)

  useEffect(() => {
    fetchBinomes()
    fetchZones()
  }, [fetchBinomes, fetchZones])

  // Calcul des statistiques
  const totalDistributions = distributions.length
  const totalAmount = distributions.reduce((sum: number, d: Distribution) => sum + (d.amount || 0), 0)
  const completedDistributions = distributions.filter((d: Distribution) => d.status === 'effectue').length

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Administration</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ padding: '16px' }}>
          {/* Statistiques rapides */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              background: 'var(--ion-color-primary)',
              color: 'white',
              padding: '16px',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{binomes.length}</div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>Binomes</div>
            </div>
            <div style={{
              background: 'var(--ion-color-success)',
              color: 'white',
              padding: '16px',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{zones.length}</div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>Zones</div>
            </div>
            <div style={{
              background: 'var(--ion-color-warning)',
              color: 'white',
              padding: '16px',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{completedDistributions}</div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>Effectuees</div>
            </div>
          </div>

          {/* Menu Admin */}
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Gestion</IonCardTitle>
              <IonCardSubtitle>Binomes et zones</IonCardSubtitle>
            </IonCardHeader>

            <IonCardContent style={{ padding: 0 }}>
              <IonList>
                <IonItem button routerLink="/admin/binomes" detail={false}>
                  <IonIcon icon={peopleOutline} slot="start" color="primary" />
                  <IonLabel>
                    <h2>Gestion des binomes</h2>
                    <p>Ajouter, modifier ou supprimer des utilisateurs</p>
                  </IonLabel>
                  {loadingBinomes ? (
                    <IonSpinner name="dots" slot="end" />
                  ) : (
                    <IonBadge slot="end" color="primary">{binomes.length}</IonBadge>
                  )}
                  <IonIcon icon={chevronForward} slot="end" color="medium" />
                </IonItem>

                <IonItem button routerLink="/admin/zones" detail={false}>
                  <IonIcon icon={mapOutline} slot="start" color="success" />
                  <IonLabel>
                    <h2>Gestion des zones</h2>
                    <p>Couleurs et assignation aux binomes</p>
                  </IonLabel>
                  {loadingZones ? (
                    <IonSpinner name="dots" slot="end" />
                  ) : (
                    <IonBadge slot="end" color="success">{zones.length}</IonBadge>
                  )}
                  <IonIcon icon={chevronForward} slot="end" color="medium" />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          {/* Statistiques detaillees */}
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={statsChartOutline} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Statistiques
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem>
                  <IonLabel>Total distributions</IonLabel>
                  <IonBadge slot="end">{totalDistributions}</IonBadge>
                </IonItem>
                <IonItem>
                  <IonLabel>Distributions effectuees</IonLabel>
                  <IonBadge slot="end" color="success">{completedDistributions}</IonBadge>
                </IonItem>
                <IonItem>
                  <IonLabel>A repasser</IonLabel>
                  <IonBadge slot="end" color="warning">
                    {distributions.filter((d: Distribution) => d.status === 'repasser').length}
                  </IonBadge>
                </IonItem>
                <IonItem>
                  <IonLabel>Refus</IonLabel>
                  <IonBadge slot="end" color="danger">
                    {distributions.filter((d: Distribution) => d.status === 'refus').length}
                  </IonBadge>
                </IonItem>
                <IonItem>
                  <IonLabel>Montant total collecte</IonLabel>
                  <IonBadge slot="end" color="primary">{totalAmount.toFixed(2)} EUR</IonBadge>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          {/* Info utilisateur */}
          <IonCard>
            <IonCardContent>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--ion-color-medium)' }}>
                Connecte en tant que: <strong>{currentUser?.binome_name}</strong>
              </p>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  )
}

export default Admin
