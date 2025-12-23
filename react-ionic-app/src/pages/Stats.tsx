import React, { useMemo } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonListHeader,
  IonItem,
  IonLabel,
  IonNote,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent
} from '@ionic/react'
import { Doughnut, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement
} from 'chart.js'
import { useDistributionsStore } from '@/stores/distributionsStore'

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, ArcElement, CategoryScale, LinearScale, BarElement)

const Stats: React.FC = () => {
  const stats = useDistributionsStore(state => state.stats)
  const filteredItems = useDistributionsStore(state => state.filteredItems)

  const currentStats = stats()
  const items = filteredItems()

  const averageAmount = useMemo(() => {
    if (currentStats.effectue === 0) return '0.00'
    return (currentStats.totalAmount / currentStats.effectue).toFixed(2)
  }, [currentStats])

  const statusChartData = useMemo(() => ({
    labels: ['Effectues', 'A repasser', 'Refus', 'Maison vide'],
    datasets: [{
      data: [currentStats.effectue, currentStats.repasser, currentStats.refus, currentStats.maison_vide],
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6b7280'],
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  }), [currentStats])

  const paymentChartData = useMemo(() => {
    const payments = items.reduce((acc: Record<string, number>, dist) => {
      if (dist.status === 'effectue' && dist.payment_method) {
        acc[dist.payment_method] = (acc[dist.payment_method] || 0) + 1
      }
      return acc
    }, {})

    const labels: Record<string, string> = {
      espece: 'Espece',
      cheque: 'Cheque',
      cb: 'CB',
      virement: 'Virement'
    }

    return {
      labels: Object.keys(payments).map(key => labels[key] || key),
      datasets: [{
        label: 'Nombre de distributions',
        data: Object.values(payments),
        backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    }
  }, [items])

  const amountChartData = useMemo(() => {
    const amounts = items.reduce((acc: Record<string, number>, dist) => {
      if (!acc[dist.status]) {
        acc[dist.status] = 0
      }
      acc[dist.status] += parseFloat(String(dist.amount)) || 0
      return acc
    }, {})

    return {
      labels: ['Effectues', 'A repasser', 'Refus', 'Maison vide'],
      datasets: [{
        label: 'Montant (EUR)',
        data: [
          amounts.effectue || 0,
          amounts.repasser || 0,
          amounts.refus || 0,
          amounts.maison_vide || 0
        ],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6b7280'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    }
  }, [items])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
          font: {
            size: 12
          }
        }
      }
    }
  }

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Statistiques</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Stats cards */}
        <div className="stats-grid">
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>&#128203;</div>
            <div className="stat-value">{currentStats.total}</div>
            <div className="stat-label">Distributions</div>
          </div>

          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>&#9989;</div>
            <div className="stat-value">{currentStats.effectue}</div>
            <div className="stat-label">Effectues</div>
          </div>

          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>&#128260;</div>
            <div className="stat-value">{currentStats.repasser}</div>
            <div className="stat-label">A repasser</div>
          </div>

          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>&#10060;</div>
            <div className="stat-value">{currentStats.refus}</div>
            <div className="stat-label">Refus</div>
          </div>

          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>&#127968;</div>
            <div className="stat-value">{currentStats.maison_vide}</div>
            <div className="stat-label">Maison vide</div>
          </div>
        </div>

        {/* Detailed stats */}
        <IonList>
          <IonListHeader>
            <IonLabel>Details</IonLabel>
          </IonListHeader>

          <IonItem>
            <IonLabel>
              <h3>Montant total</h3>
              <p>Somme collectee</p>
            </IonLabel>
            <IonNote slot="end" color="primary">
              {currentStats.totalAmount.toFixed(2)} EUR
            </IonNote>
          </IonItem>

          <IonItem>
            <IonLabel>
              <h3>Taux de reussite</h3>
              <p>Distributions effectuees</p>
            </IonLabel>
            <IonNote slot="end" color="success">
              {currentStats.successRate}%
            </IonNote>
          </IonItem>

          <IonItem>
            <IonLabel>
              <h3>Montant moyen</h3>
              <p>Par distribution effectuee</p>
            </IonLabel>
            <IonNote slot="end">
              {averageAmount} EUR
            </IonNote>
          </IonItem>
        </IonList>

        {/* Charts */}
        <div className="charts-section">
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Repartition par statut</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <div className="chart-container">
                <Doughnut data={statusChartData} options={chartOptions} />
              </div>
            </IonCardContent>
          </IonCard>

          {paymentChartData.labels.length > 0 && (
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Moyens de paiement</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div className="chart-container">
                  <Bar data={paymentChartData} options={barChartOptions} />
                </div>
              </IonCardContent>
            </IonCard>
          )}

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Montants collectes par statut</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <div className="chart-container">
                <Bar data={amountChartData} options={barChartOptions} />
              </div>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  )
}

export default Stats
