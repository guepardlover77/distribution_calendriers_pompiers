import { create } from 'zustand'
import { apiService } from '@/services/api'
import { useDemoStore, isDemoMode } from './demoStore'

export interface Zone {
  Id?: string
  id?: string
  name: string
  color?: string
  binome_id?: string
  binome_name?: string
  geojson?: string
}

interface ZonesState {
  zones: Zone[]
  loading: boolean
  error: string | null

  // Actions
  fetchZones: () => Promise<void>
  createZone: (data: Partial<Zone>) => Promise<Zone>
  updateZone: (id: string, data: Partial<Zone>) => Promise<Zone>
  deleteZone: (id: string) => Promise<void>
  assignBinome: (zoneId: string, binomeId: string, binomeName: string) => Promise<void>
  updateColor: (zoneId: string, color: string) => Promise<void>
  getZoneById: (id: string) => Zone | undefined
}

export const useZonesStore = create<ZonesState>((set, get) => ({
  zones: [],
  loading: false,
  error: null,

  fetchZones: async () => {
    // Mode démo : utiliser les données du demoStore
    if (isDemoMode()) {
      const demoStore = useDemoStore.getState()
      set({ zones: demoStore.zones as Zone[], loading: false, error: null })
      return
    }

    set({ loading: true, error: null })
    try {
      if (!apiService.isReady) {
        await apiService.init()
      }
      const zones = await apiService.getZones<Zone>()
      set({ zones, loading: false })
    } catch (error) {
      const message = (error as Error).message || 'Erreur lors du chargement des zones'
      set({ error: message, loading: false })
      throw error
    }
  },

  createZone: async (data: Partial<Zone>) => {
    // Mode démo : créer localement uniquement
    if (isDemoMode()) {
      const demoStore = useDemoStore.getState()
      const newZone = demoStore.addZone(data) as Zone
      set(state => ({
        zones: [...state.zones, newZone],
        loading: false
      }))
      return newZone
    }

    set({ loading: true, error: null })
    try {
      if (!apiService.isReady) {
        console.log('[ZonesStore] Initializing API service...')
        await apiService.init()
      }
      if (!apiService.config) throw new Error('API non configuree')

      console.log('[ZonesStore] Creating zone in table:', apiService.config.tables.zones)
      console.log('[ZonesStore] Zone data:', data)

      const newZone = await apiService.create<Zone>(
        apiService.config.tables.zones,
        data
      )

      console.log('[ZonesStore] Zone created successfully:', newZone)

      set(state => ({
        zones: [...state.zones, newZone],
        loading: false
      }))

      return newZone
    } catch (error) {
      console.error('[ZonesStore] Error creating zone:', error)
      const message = (error as Error).message || 'Erreur lors de la creation de la zone'
      set({ error: message, loading: false })
      throw error
    }
  },

  updateZone: async (id: string, data: Partial<Zone>) => {
    // Mode démo : modifier localement uniquement
    if (isDemoMode()) {
      const demoStore = useDemoStore.getState()
      demoStore.updateZone(id, data)
      set(state => ({
        zones: state.zones.map(z =>
          (z.Id === id || z.id === id) ? { ...z, ...data } : z
        ),
        loading: false
      }))
      return { ...data, id } as Zone
    }

    set({ loading: true, error: null })
    try {
      if (!apiService.isReady) {
        await apiService.init()
      }
      if (!apiService.config) throw new Error('API non configuree')

      const updatedZone = await apiService.update<Zone>(
        apiService.config.tables.zones,
        id,
        data
      )

      set(state => ({
        zones: state.zones.map(z =>
          (z.Id === id || z.id === id) ? { ...z, ...updatedZone } : z
        ),
        loading: false
      }))

      return updatedZone
    } catch (error) {
      const message = (error as Error).message || 'Erreur lors de la mise a jour de la zone'
      set({ error: message, loading: false })
      throw error
    }
  },

  deleteZone: async (id: string) => {
    // Mode démo : supprimer localement uniquement
    if (isDemoMode()) {
      const demoStore = useDemoStore.getState()
      demoStore.deleteZone(id)
      set(state => ({
        zones: state.zones.filter(z => z.Id !== id && z.id !== id),
        loading: false
      }))
      return
    }

    set({ loading: true, error: null })
    try {
      if (!apiService.isReady) {
        await apiService.init()
      }
      if (!apiService.config) throw new Error('API non configuree')

      await apiService.delete(apiService.config.tables.zones, id)

      set(state => ({
        zones: state.zones.filter(z => z.Id !== id && z.id !== id),
        loading: false
      }))
    } catch (error) {
      const message = (error as Error).message || 'Erreur lors de la suppression de la zone'
      set({ error: message, loading: false })
      throw error
    }
  },

  assignBinome: async (zoneId: string, binomeId: string, binomeName: string) => {
    await get().updateZone(zoneId, {
      binome_id: binomeId,
      binome_name: binomeName
    })
  },

  updateColor: async (zoneId: string, color: string) => {
    await get().updateZone(zoneId, { color })
  },

  getZoneById: (id: string) => {
    return get().zones.find(z => z.Id === id || z.id === id)
  }
}))
