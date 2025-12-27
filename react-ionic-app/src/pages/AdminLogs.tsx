import React, { useEffect, useState } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonChip,
  IonSelect,
  IonSelectOption,
  IonItem,
  IonLabel,
  IonDatetime,
  IonModal,
  useIonToast
} from '@ionic/react'
import {
  downloadOutline,
  filterOutline,
  closeCircle,
  documentTextOutline,
  personOutline,
  timeOutline,
  trashOutline,
  logInOutline,
  logOutOutline,
  refreshOutline,
  addCircleOutline
} from 'ionicons/icons'
import { useLogsStore } from '@/stores/logsStore'
import { useBinomesStore } from '@/stores/binomesStore'
import { Log, LogAction, LogEntityType, ACTION_LABELS, ENTITY_LABELS } from '@/types/log'
import { Capacitor } from '@capacitor/core'

const AdminLogs: React.FC = () => {
  const [presentToast] = useIonToast()
  const {
    logs,
    loading,
    error,
    filters,
    fetchLogs,
    setFilter,
    resetFilters,
    filteredLogs,
    exportToCsv
  } = useLogsStore()
  const { binomes, fetchBinomes } = useBinomesStore()

  const [showFilters, setShowFilters] = useState(false)
  const [showDateFrom, setShowDateFrom] = useState(false)
  const [showDateTo, setShowDateTo] = useState(false)

  useEffect(() => {
    fetchLogs()
    fetchBinomes()
  }, [fetchLogs, fetchBinomes])

  const handleRefresh = async (event: CustomEvent) => {
    await fetchLogs()
    event.detail.complete()
  }

  // Export CSV handler
  const handleExport = async () => {
    const csvContent = exportToCsv()
    const filename = `logs_${new Date().toISOString().split('T')[0]}.csv`

    if (Capacitor.isNativePlatform()) {
      // Mobile: utiliser le partage natif
      try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const file = new File([blob], filename, { type: 'text/csv' })

        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Export des logs'
          })
        } else {
          // Fallback: telecharger
          downloadCsv(csvContent, filename)
        }

        presentToast({
          message: 'Export pret',
          duration: 2000,
          color: 'success',
          position: 'top'
        })
      } catch (err) {
        console.error('Export error:', err)
        // Fallback: telecharger
        downloadCsv(csvContent, filename)
      }
    } else {
      // Web: telecharger
      downloadCsv(csvContent, filename)
      presentToast({
        message: 'Fichier CSV telecharge',
        duration: 2000,
        color: 'success',
        position: 'top'
      })
    }
  }

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Action icon helper
  const getActionIcon = (action: LogAction) => {
    switch (action) {
      case 'create': return addCircleOutline
      case 'update': return refreshOutline
      case 'delete': return trashOutline
      case 'login':
      case 'login_demo': return logInOutline
      case 'logout':
      case 'logout_demo': return logOutOutline
      default: return documentTextOutline
    }
  }

  // Action color helper
  const getActionColor = (action: LogAction) => {
    switch (action) {
      case 'create': return '#10b981'
      case 'update': return '#3b82f6'
      case 'delete': return '#ef4444'
      case 'login':
      case 'login_demo': return '#8b5cf6'
      case 'logout':
      case 'logout_demo': return '#f59e0b'
      default: return '#6b7280'
    }
  }

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const isToday = date.toDateString() === today.toDateString()
    const isYesterday = date.toDateString() === yesterday.toDateString()

    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

    if (isToday) return `Aujourd'hui ${time}`
    if (isYesterday) return `Hier ${time}`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ` ${time}`
  }

  const displayedLogs = filteredLogs()
  const hasActiveFilters = filters.action !== 'all' ||
                           filters.entityType !== 'all' ||
                           filters.userId !== 'all' ||
                           filters.dateFrom ||
                           filters.dateTo ||
                           filters.searchQuery

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/admin" text="Retour" />
          </IonButtons>
          <IonTitle>Journal d'activite</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleExport} disabled={displayedLogs.length === 0}>
              <IonIcon icon={downloadOutline} />
            </IonButton>
            <IonButton onClick={() => setShowFilters(true)}>
              <IonIcon icon={filterOutline} color={hasActiveFilters ? 'primary' : undefined} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: '16px', paddingBottom: '100px' }}>
          {/* Stats bar */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px',
            overflowX: 'auto',
            paddingBottom: '8px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: 'white',
              padding: '12px 16px',
              borderRadius: '12px',
              minWidth: '100px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700' }}>{displayedLogs.length}</div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>
                {hasActiveFilters ? 'Filtres' : 'Total'}
              </div>
            </div>
          </div>

          {/* Search bar */}
          <IonSearchbar
            value={filters.searchQuery}
            onIonInput={(e) => setFilter('searchQuery', e.detail.value || '')}
            placeholder="Rechercher..."
            style={{
              '--background': 'var(--ion-color-light)',
              '--border-radius': '12px',
              marginBottom: '16px',
              padding: 0
            }}
          />

          {/* Active filters chips */}
          {hasActiveFilters && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '16px'
            }}>
              {filters.action !== 'all' && (
                <IonChip onClick={() => setFilter('action', 'all')}>
                  {ACTION_LABELS[filters.action as LogAction]}
                  <IonIcon icon={closeCircle} />
                </IonChip>
              )}
              {filters.entityType !== 'all' && (
                <IonChip onClick={() => setFilter('entityType', 'all')}>
                  {ENTITY_LABELS[filters.entityType as LogEntityType]}
                  <IonIcon icon={closeCircle} />
                </IonChip>
              )}
              {filters.userId !== 'all' && (
                <IonChip onClick={() => setFilter('userId', 'all')}>
                  {filters.userId}
                  <IonIcon icon={closeCircle} />
                </IonChip>
              )}
              {(filters.dateFrom || filters.dateTo) && (
                <IonChip onClick={() => { setFilter('dateFrom', undefined); setFilter('dateTo', undefined) }}>
                  {filters.dateFrom && new Date(filters.dateFrom).toLocaleDateString('fr-FR')}
                  {filters.dateFrom && filters.dateTo && ' - '}
                  {filters.dateTo && new Date(filters.dateTo).toLocaleDateString('fr-FR')}
                  <IonIcon icon={closeCircle} />
                </IonChip>
              )}
              <IonButton fill="clear" size="small" onClick={resetFilters}>
                Tout effacer
              </IonButton>
            </div>
          )}

          {/* Logs list */}
          {loading && logs.length === 0 ? (
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
          ) : displayedLogs.length === 0 ? (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              background: 'var(--ion-color-light)',
              borderRadius: '16px'
            }}>
              <IonIcon icon={documentTextOutline} style={{ fontSize: '64px', color: 'var(--ion-color-medium)', opacity: 0.5 }} />
              <p style={{ color: 'var(--ion-color-medium)', marginTop: '16px', fontSize: '16px' }}>
                Aucun log trouve
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {displayedLogs.map(log => (
                <LogCard
                  key={log.Id || log.id}
                  log={log}
                  getActionIcon={getActionIcon}
                  getActionColor={getActionColor}
                  formatTimestamp={formatTimestamp}
                />
              ))}
            </div>
          )}
        </div>

        {/* Filters Modal */}
        <IonModal
          isOpen={showFilters}
          onDidDismiss={() => setShowFilters(false)}
          initialBreakpoint={0.75}
          breakpoints={[0, 0.5, 0.75]}
        >
          <div style={{ padding: '24px' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600' }}>
              Filtres
            </h2>

            {/* Action filter */}
            <IonItem>
              <IonLabel>Action</IonLabel>
              <IonSelect
                value={filters.action}
                onIonChange={(e) => setFilter('action', e.detail.value)}
              >
                <IonSelectOption value="all">Toutes</IonSelectOption>
                <IonSelectOption value="create">Creation</IonSelectOption>
                <IonSelectOption value="update">Modification</IonSelectOption>
                <IonSelectOption value="delete">Suppression</IonSelectOption>
                <IonSelectOption value="login">Connexion</IonSelectOption>
                <IonSelectOption value="logout">Deconnexion</IonSelectOption>
              </IonSelect>
            </IonItem>

            {/* Entity type filter */}
            <IonItem>
              <IonLabel>Type d'entite</IonLabel>
              <IonSelect
                value={filters.entityType}
                onIonChange={(e) => setFilter('entityType', e.detail.value)}
              >
                <IonSelectOption value="all">Tous</IonSelectOption>
                <IonSelectOption value="distribution">Distributions</IonSelectOption>
                <IonSelectOption value="zone">Zones</IonSelectOption>
                <IonSelectOption value="binome">Binomes</IonSelectOption>
                <IonSelectOption value="session">Sessions</IonSelectOption>
              </IonSelect>
            </IonItem>

            {/* User filter */}
            <IonItem>
              <IonLabel>Utilisateur</IonLabel>
              <IonSelect
                value={filters.userId}
                onIonChange={(e) => setFilter('userId', e.detail.value)}
              >
                <IonSelectOption value="all">Tous</IonSelectOption>
                {binomes.map(b => (
                  <IonSelectOption key={b.Id || b.id} value={b.username}>
                    {b.binome_name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            {/* Date from */}
            <IonItem button onClick={() => setShowDateFrom(true)}>
              <IonLabel>Date debut</IonLabel>
              <span style={{ color: 'var(--ion-color-medium)' }}>
                {filters.dateFrom
                  ? new Date(filters.dateFrom).toLocaleDateString('fr-FR')
                  : 'Non definie'}
              </span>
            </IonItem>

            {/* Date to */}
            <IonItem button onClick={() => setShowDateTo(true)}>
              <IonLabel>Date fin</IonLabel>
              <span style={{ color: 'var(--ion-color-medium)' }}>
                {filters.dateTo
                  ? new Date(filters.dateTo).toLocaleDateString('fr-FR')
                  : 'Non definie'}
              </span>
            </IonItem>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <IonButton
                expand="block"
                fill="outline"
                style={{ flex: 1 }}
                onClick={resetFilters}
              >
                Reinitialiser
              </IonButton>
              <IonButton
                expand="block"
                style={{ flex: 1 }}
                onClick={() => setShowFilters(false)}
              >
                Appliquer
              </IonButton>
            </div>
          </div>
        </IonModal>

        {/* Date From Picker */}
        <IonModal isOpen={showDateFrom} onDidDismiss={() => setShowDateFrom(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Date de debut</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowDateFrom(false)}>Fermer</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <IonDatetime
              presentation="date"
              value={filters.dateFrom || undefined}
              onIonChange={(e) => {
                setFilter('dateFrom', e.detail.value as string)
                setShowDateFrom(false)
              }}
              style={{ margin: 'auto' }}
            />
          </IonContent>
        </IonModal>

        {/* Date To Picker */}
        <IonModal isOpen={showDateTo} onDidDismiss={() => setShowDateTo(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Date de fin</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowDateTo(false)}>Fermer</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <IonDatetime
              presentation="date"
              value={filters.dateTo || undefined}
              onIonChange={(e) => {
                setFilter('dateTo', e.detail.value as string)
                setShowDateTo(false)
              }}
              style={{ margin: 'auto' }}
            />
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  )
}

// Log Card Component
interface LogCardProps {
  log: Log
  getActionIcon: (action: LogAction) => string
  getActionColor: (action: LogAction) => string
  formatTimestamp: (timestamp: string) => string
}

const LogCard: React.FC<LogCardProps> = ({
  log,
  getActionIcon,
  getActionColor,
  formatTimestamp
}) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      style={{
        background: 'var(--ion-background-color)',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        borderLeft: `4px solid ${getActionColor(log.action)}`
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          backgroundColor: getActionColor(log.action),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <IonIcon icon={getActionIcon(log.action)} style={{ color: 'white', fontSize: '20px' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '600', fontSize: '15px' }}>
            {ACTION_LABELS[log.action]} - {ENTITY_LABELS[log.entity_type]}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--ion-color-medium)' }}>
            {log.entity_name || log.entity_id}
          </div>
        </div>
        {log.is_demo && (
          <IonChip style={{
            '--background': 'rgba(245, 158, 11, 0.1)',
            '--color': '#d97706',
            margin: 0,
            height: '24px',
            fontSize: '11px'
          }}>
            Demo
          </IonChip>
        )}
      </div>

      {/* Meta info */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginTop: '12px',
        fontSize: '12px',
        color: 'var(--ion-color-medium)'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <IonIcon icon={personOutline} />
          {log.user_name}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <IonIcon icon={timeOutline} />
          {formatTimestamp(log.timestamp)}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (log.old_values || log.new_values || log.ip_address) && (
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid var(--ion-color-light)',
          fontSize: '12px'
        }}>
          {log.old_values && (
            <div style={{ marginBottom: '8px' }}>
              <strong>Avant:</strong>
              <pre style={{
                background: 'var(--ion-color-light)',
                padding: '8px',
                borderRadius: '8px',
                overflow: 'auto',
                margin: '4px 0',
                fontSize: '11px'
              }}>
                {JSON.stringify(JSON.parse(log.old_values), null, 2)}
              </pre>
            </div>
          )}
          {log.new_values && (
            <div style={{ marginBottom: '8px' }}>
              <strong>Apres:</strong>
              <pre style={{
                background: 'var(--ion-color-light)',
                padding: '8px',
                borderRadius: '8px',
                overflow: 'auto',
                margin: '4px 0',
                fontSize: '11px'
              }}>
                {JSON.stringify(JSON.parse(log.new_values), null, 2)}
              </pre>
            </div>
          )}
          {log.ip_address && (
            <div style={{ marginTop: '8px', color: 'var(--ion-color-medium)' }}>
              IP: {log.ip_address} | {log.platform} | {log.device_type}
              {log.session_duration && ` | Session: ${Math.floor(log.session_duration / 60)}min`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminLogs
