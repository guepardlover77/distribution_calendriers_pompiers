import React, { useMemo } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  IonProgressBar
} from '@ionic/react'
import {
  documentTextOutline,
  checkmarkCircleOutline,
  refreshOutline,
  closeCircleOutline,
  homeOutline,
  cashOutline,
  trendingUpOutline,
  walletOutline
} from 'ionicons/icons'
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
        <IonToolbar color="primary">
          <IonTitle>Statistiques</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="stats-content">
        {/* Hero section with total amount */}
        <div className="stats-hero">
          <div className="stats-hero-icon">
            <IonIcon icon={cashOutline} />
          </div>
          <div className="stats-hero-amount">{currentStats.totalAmount.toFixed(2)} EUR</div>
          <div className="stats-hero-label">Montant total collecte</div>
          <div className="stats-hero-meta">
            <span className="stats-hero-meta-item">
              <IonIcon icon={trendingUpOutline} />
              {currentStats.successRate}% de reussite
            </span>
            <span className="stats-hero-meta-item">
              <IonIcon icon={walletOutline} />
              {averageAmount} EUR / distribution
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="stats-progress-section">
          <div className="stats-progress-header">
            <span>Progression</span>
            <span>{currentStats.effectue} / {currentStats.total}</span>
          </div>
          <IonProgressBar
            value={currentStats.total > 0 ? currentStats.effectue / currentStats.total : 0}
            color="success"
          />
        </div>

        {/* Stats cards */}
        <div className="stats-grid">
          <div className="stat-card stat-card-total">
            <div className="stat-card-icon">
              <IonIcon icon={documentTextOutline} />
            </div>
            <div className="stat-card-content">
              <div className="stat-value">{currentStats.total}</div>
              <div className="stat-label">Total</div>
            </div>
          </div>

          <div className="stat-card stat-card-success">
            <div className="stat-card-icon">
              <IonIcon icon={checkmarkCircleOutline} />
            </div>
            <div className="stat-card-content">
              <div className="stat-value">{currentStats.effectue}</div>
              <div className="stat-label">Effectues</div>
            </div>
          </div>

          <div className="stat-card stat-card-warning">
            <div className="stat-card-icon">
              <IonIcon icon={refreshOutline} />
            </div>
            <div className="stat-card-content">
              <div className="stat-value">{currentStats.repasser}</div>
              <div className="stat-label">A repasser</div>
            </div>
          </div>

          <div className="stat-card stat-card-danger">
            <div className="stat-card-icon">
              <IonIcon icon={closeCircleOutline} />
            </div>
            <div className="stat-card-content">
              <div className="stat-value">{currentStats.refus}</div>
              <div className="stat-label">Refus</div>
            </div>
          </div>

          <div className="stat-card stat-card-neutral">
            <div className="stat-card-icon">
              <IonIcon icon={homeOutline} />
            </div>
            <div className="stat-card-content">
              <div className="stat-value">{currentStats.maison_vide}</div>
              <div className="stat-label">Maison vide</div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="charts-section">
          <IonCard className="chart-card">
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
            <IonCard className="chart-card">
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

          <IonCard className="chart-card">
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
