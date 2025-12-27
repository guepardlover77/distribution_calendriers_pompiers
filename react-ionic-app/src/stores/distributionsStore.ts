import { create } from 'zustand'
import { apiService } from '@/services/api'
import { storageService, Distribution } from '@/services/storage'
import { loggingService } from '@/services/loggingService'
import { useAuthStore } from './authStore'
import { useDemoStore, isDemoMode } from './demoStore'

interface Filters {
  status: string
  searchQuery: string
  dateFrom: string | null
  dateTo: string | null
  payment: string
  binome: string
  zone: string | null
}

interface Stats {
  total: number
  effectue: number
  repasser: number
  refus: number
  maison_vide: number
  totalAmount: number
  successRate: string
}

interface DistributionsState {
  items: Distribution[]
  loading: boolean
  filters: Filters

  // Getters
  filteredItems: () => Distribution[]
  stats: () => Stats

  // Actions
  loadFromStorage: () => Promise<void>
  saveToStorage: () => Promise<void>
  fetchAll: () => Promise<void>
  create: (distribution: Partial<Distribution>) => Promise<Distribution>
  update: (id: string, updates: Partial<Distribution>) => Promise<void>
  remove: (id: string) => Promise<void>
  setFilter: (key: keyof Filters, value: string | null) => void
  resetFilters: () => void
}

const defaultFilters: Filters = {
  status: 'all',
  searchQuery: '',
  dateFrom: null,
  dateTo: null,
  payment: 'all',
  binome: 'all',
  zone: null
}

export const useDistributionsStore = create<DistributionsState>((set, get) => ({
  items: [],
  loading: false,
  filters: { ...defaultFilters },

  filteredItems: () => {
    const { items, filters } = get()
    const authStore = useAuthStore.getState()

    let result = items

    // Permission filter
    if (!authStore.isAdmin()) {
      result = result.filter(d => authStore.canAccessDistribution(d))
    }

    // Status filter
    if (filters.status !== 'all') {
      result = result.filter(d => d.status === filters.status)
    }

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      result = result.filter(d =>
        d.address?.toLowerCase().includes(query) ||
        d.notes?.toLowerCase().includes(query)
      )
    }

    // Date filters
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom)
      result = result.filter(d => new Date(d.createdAt) >= fromDate)
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo)
      toDate.setHours(23, 59, 59)
      result = result.filter(d => new Date(d.createdAt) <= toDate)
    }

    // Payment filter
    if (filters.payment !== 'all') {
      if (filters.payment === 'unspecified') {
        result = result.filter(d => !d.payment && !d.payment_method)
      } else {
        result = result.filter(d => d.payment === filters.payment || d.payment_method === filters.payment)
      }
    }

    // Binome filter
    if (filters.binome !== 'all') {
      result = result.filter(d => d.binome_id === filters.binome)
    }

    return result
  },

  stats: () => {
    const filtered = get().filteredItems()

    return {
      total: filtered.length,
      effectue: filtered.filter(d => d.status === 'effectue').length,
      repasser: filtered.filter(d => d.status === 'repasser').length,
      refus: filtered.filter(d => d.status === 'refus').length,
      maison_vide: filtered.filter(d => d.status === 'maison_vide').length,
      totalAmount: filtered.reduce((sum, d) => sum + (parseFloat(String(d.amount)) || 0), 0),
      successRate: filtered.length > 0
        ? ((filtered.filter(d => d.status === 'effectue').length / filtered.length) * 100).toFixed(1)
        : '0'
    }
  },

  loadFromStorage: async () => {
    set({ loading: true })
    try {
      const data = await storageService.loadDistributions()
      set({ items: data || [] })
    } catch (error) {
      console.error('[DistributionsStore] Erreur chargement:', error)
      set({ items: [] })
    } finally {
      set({ loading: false })
    }
  },

  saveToStorage: async () => {
    try {
      await storageService.saveDistributions(get().items)
    } catch (error) {
      console.error('[DistributionsStore] Erreur sauvegarde:', error)
      throw error
    }
  },

  fetchAll: async () => {
    // Mode démo : utiliser les données du demoStore
    if (isDemoMode()) {
      const demoStore = useDemoStore.getState()
      set({ items: demoStore.distributions, loading: false })
      return
    }

    set({ loading: true })
    try {
      const rawData = await apiService.getDistributions<Record<string, unknown>>()
      console.log('[DistributionsStore] Raw data from API:', rawData?.length, 'items')

      // Mapper les donnees NocoDB vers le format local
      const data: Distribution[] = (rawData || []).map(item => ({
        id: String(item.Id || item.id || item.localId || Date.now()),
        address: String(item.address || ''),
        lat: Number(item.lat) || 0,
        lng: Number(item.lng) || 0,
        status: (item.status as Distribution['status']) || 'effectue',
        amount: Number(item.amount) || 0,
        payment: item.payment as string | undefined,
        payment_method: item.payment_method as string | undefined,
        notes: item.notes as string | undefined,
        binome_id: String(item.binome_id || ''),
        recipient_name: item.recipient_name as string | undefined,
        createdAt: String(item.createdAt || item.created_at || new Date().toISOString()),
        updatedAt: String(item.updatedAt || item.updated_at || new Date().toISOString()),
        localId: item.localId as string | undefined
      }))

      console.log('[DistributionsStore] Mapped data:', data.length, 'items')
      set({ items: data })
      await get().saveToStorage()
    } catch (error) {
      console.error('[DistributionsStore] Erreur fetch:', error)
      await get().loadFromStorage()
    } finally {
      set({ loading: false })
    }
  },

  create: async (distribution) => {
    // Mode démo : créer localement uniquement
    if (isDemoMode()) {
      const demoStore = useDemoStore.getState()
      const newDist = demoStore.addDistribution(distribution)
      set(state => ({ items: [...state.items, newDist] }))

      // Log creation en mode demo
      await loggingService.logCreate('distribution', newDist.id, newDist.address, {
        address: newDist.address,
        status: newDist.status,
        amount: newDist.amount,
        binome_id: newDist.binome_id
      })

      return newDist
    }

    const authStore = useAuthStore.getState()

    const newDist: Distribution = {
      id: Date.now().toString(),
      address: distribution.address || '',
      lat: distribution.lat || 0,
      lng: distribution.lng || 0,
      status: distribution.status || 'effectue',
      amount: distribution.amount || 0,
      payment: distribution.payment,
      payment_method: distribution.payment_method,
      notes: distribution.notes,
      binome_id: authStore.currentUser?.username || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    set(state => ({ items: [...state.items, newDist] }))
    await get().saveToStorage()

    // Log creation
    await loggingService.logCreate('distribution', newDist.id, newDist.address, {
      address: newDist.address,
      status: newDist.status,
      amount: newDist.amount,
      binome_id: newDist.binome_id
    })

    // Background sync with API
    try {
      if (apiService.config) {
        const tableName = apiService.config.tables.distributions
        await apiService.create(tableName, {
          localId: newDist.id,
          ...newDist
        })
      }
    } catch (error) {
      console.error('[DistributionsStore] Erreur creation API:', error)
    }

    return newDist
  },

  update: async (id, updates) => {
    // Capturer les anciennes valeurs AVANT la modification
    const oldItem = get().items.find(d => d.id === id)
    const oldValues = oldItem ? {
      address: oldItem.address,
      status: oldItem.status,
      amount: oldItem.amount,
      notes: oldItem.notes,
      payment_method: oldItem.payment_method
    } : {}

    // Mode démo : modifier localement uniquement
    if (isDemoMode()) {
      const demoStore = useDemoStore.getState()
      demoStore.updateDistribution(id, updates)
      set(state => ({
        items: state.items.map(d =>
          d.id === id
            ? { ...d, ...updates, updatedAt: new Date().toISOString() }
            : d
        )
      }))

      // Log modification en mode demo
      await loggingService.logUpdate('distribution', id, oldItem?.address || id, oldValues, updates)

      return
    }

    set(state => ({
      items: state.items.map(d =>
        d.id === id
          ? { ...d, ...updates, updatedAt: new Date().toISOString() }
          : d
      )
    }))
    await get().saveToStorage()

    // Log modification
    await loggingService.logUpdate('distribution', id, oldItem?.address || id, oldValues, updates)

    // Background sync with API
    try {
      if (apiService.config) {
        const tableName = apiService.config.tables.distributions
        const existing = await findByLocalId(tableName, id)
        if (existing) {
          const nocoId = (existing as { Id?: string; id?: string }).Id || (existing as { Id?: string; id?: string }).id
          if (nocoId) {
            await apiService.update(tableName, nocoId, updates)
          }
        }
      }
    } catch (error) {
      console.error('[DistributionsStore] Erreur update API:', error)
    }
  },

  remove: async (id) => {
    // Capturer les anciennes valeurs AVANT la suppression
    const oldItem = get().items.find(d => d.id === id)
    const oldValues = oldItem ? {
      address: oldItem.address,
      status: oldItem.status,
      amount: oldItem.amount,
      binome_id: oldItem.binome_id
    } : {}

    // Mode démo : supprimer localement uniquement
    if (isDemoMode()) {
      const demoStore = useDemoStore.getState()
      demoStore.deleteDistribution(id)
      set(state => ({
        items: state.items.filter(d => d.id !== id)
      }))

      // Log suppression en mode demo
      await loggingService.logDelete('distribution', id, oldItem?.address || id, oldValues)

      return
    }

    set(state => ({
      items: state.items.filter(d => d.id !== id)
    }))
    await get().saveToStorage()

    // Log suppression
    await loggingService.logDelete('distribution', id, oldItem?.address || id, oldValues)

    // Background sync with API
    try {
      if (apiService.config) {
        const tableName = apiService.config.tables.distributions
        const existing = await findByLocalId(tableName, id)
        if (existing) {
          const nocoId = (existing as { Id?: string; id?: string }).Id || (existing as { Id?: string; id?: string }).id
          if (nocoId) {
            await apiService.delete(tableName, nocoId)
          }
        }
      }
    } catch (error) {
      console.error('[DistributionsStore] Erreur delete API:', error)
    }
  },

  setFilter: (key, value) => {
    set(state => ({
      filters: { ...state.filters, [key]: value }
    }))
  },

  resetFilters: () => {
    set({ filters: { ...defaultFilters } })
  }
}))

async function findByLocalId(tableName: string, localId: string): Promise<unknown | null> {
  try {
    const records = await apiService.list<{ localId?: string }>(tableName, {
      where: `(localId,eq,${encodeURIComponent(localId)})`
    })
    return records[0] || null
  } catch {
    return null
  }
}
