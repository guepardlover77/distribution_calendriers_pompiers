import { create } from 'zustand'
import { apiService } from '@/services/api'
import { Log, LogFilters, ACTION_LABELS, ENTITY_LABELS } from '@/types/log'

interface LogsState {
  logs: Log[]
  loading: boolean
  error: string | null
  filters: LogFilters
  totalCount: number

  // Actions
  fetchLogs: () => Promise<void>
  setFilter: <K extends keyof LogFilters>(key: K, value: LogFilters[K]) => void
  resetFilters: () => void

  // Computed
  filteredLogs: () => Log[]

  // Export
  exportToCsv: () => string
}

const defaultFilters: LogFilters = {
  dateFrom: undefined,
  dateTo: undefined,
  action: 'all',
  entityType: 'all',
  userId: 'all',
  searchQuery: ''
}

export const useLogsStore = create<LogsState>((set, get) => ({
  logs: [],
  loading: false,
  error: null,
  filters: { ...defaultFilters },
  totalCount: 0,

  fetchLogs: async () => {
    set({ loading: true, error: null })

    try {
      if (!apiService.isReady) {
        await apiService.init()
      }

      // Fetch logs sorted by timestamp descending
      const logs = await apiService.list<Log>('Logs', {
        limit: 5000
      })

      // Sort by timestamp descending (most recent first)
      const sortedLogs = logs.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      set({ logs: sortedLogs, totalCount: sortedLogs.length, loading: false })
    } catch (error) {
      const message = (error as Error).message || 'Erreur lors du chargement des logs'
      set({ error: message, loading: false })
      console.error('[LogsStore] Fetch error:', error)
    }
  },

  setFilter: (key, value) => {
    set(state => ({
      filters: { ...state.filters, [key]: value }
    }))
  },

  resetFilters: () => {
    set({ filters: { ...defaultFilters } })
  },

  filteredLogs: () => {
    const { logs, filters } = get()
    let result = logs

    // Filter by date range
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom)
      fromDate.setHours(0, 0, 0, 0)
      result = result.filter(log => new Date(log.timestamp) >= fromDate)
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo)
      toDate.setHours(23, 59, 59, 999)
      result = result.filter(log => new Date(log.timestamp) <= toDate)
    }

    // Filter by action
    if (filters.action && filters.action !== 'all') {
      result = result.filter(log => log.action === filters.action)
    }

    // Filter by entity type
    if (filters.entityType && filters.entityType !== 'all') {
      result = result.filter(log => log.entity_type === filters.entityType)
    }

    // Filter by user
    if (filters.userId && filters.userId !== 'all') {
      result = result.filter(log => log.user_id === filters.userId)
    }

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      result = result.filter(log =>
        log.entity_name?.toLowerCase().includes(query) ||
        log.user_name.toLowerCase().includes(query) ||
        log.user_id.toLowerCase().includes(query)
      )
    }

    return result
  },

  exportToCsv: () => {
    const logs = get().filteredLogs()

    // CSV headers
    const headers = [
      'Date/Heure',
      'Action',
      'Type',
      'Entite',
      'Utilisateur',
      'Anciennes valeurs',
      'Nouvelles valeurs',
      'IP',
      'Appareil',
      'Plateforme',
      'Duree session (s)',
      'Demo'
    ]

    // CSV rows
    const rows = logs.map(log => [
      new Date(log.timestamp).toLocaleString('fr-FR'),
      ACTION_LABELS[log.action] || log.action,
      ENTITY_LABELS[log.entity_type] || log.entity_type,
      log.entity_name || log.entity_id,
      `${log.user_name} (${log.user_id})`,
      log.old_values || '',
      log.new_values || '',
      log.ip_address || '',
      log.device_type || '',
      log.platform || '',
      log.session_duration?.toString() || '',
      log.is_demo ? 'Oui' : 'Non'
    ])

    // Escape CSV values
    const escapeCsv = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }

    // Build CSV string with BOM for UTF-8
    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(escapeCsv).join(','))
    ].join('\n')

    return csvContent
  }
}))
