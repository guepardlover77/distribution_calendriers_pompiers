import { create } from 'zustand'
import { apiService } from '@/services/api'
import { loggingService } from '@/services/loggingService'
import { useDemoStore, isDemoMode } from './demoStore'

export interface Binome {
  Id?: string
  id?: string
  username: string
  password: string
  binome_name: string
  assigned_zone: string
  is_admin: boolean | number | string
  last_login?: string
}

interface BinomesState {
  binomes: Binome[]
  loading: boolean
  error: string | null

  // Actions
  fetchBinomes: () => Promise<void>
  createBinome: (data: Partial<Binome>) => Promise<Binome>
  updateBinome: (id: string, data: Partial<Binome>) => Promise<Binome>
  deleteBinome: (id: string) => Promise<void>
  getBinomeById: (id: string) => Binome | undefined
  getBinomeByUsername: (username: string) => Binome | undefined
}

export const useBinomesStore = create<BinomesState>((set, get) => ({
  binomes: [],
  loading: false,
  error: null,

  fetchBinomes: async () => {
    // Mode démo : utiliser les données du demoStore
    if (isDemoMode()) {
      const demoStore = useDemoStore.getState()
      set({ binomes: demoStore.binomes as Binome[], loading: false, error: null })
      return
    }

    set({ loading: true, error: null })
    try {
      if (!apiService.isReady) {
        await apiService.init()
      }
      const binomes = await apiService.getBinomes()
      set({ binomes, loading: false })
    } catch (error) {
      const message = (error as Error).message || 'Erreur lors du chargement des binomes'
      set({ error: message, loading: false })
      throw error
    }
  },

  createBinome: async (data: Partial<Binome>) => {
    // Mode démo : créer localement uniquement
    if (isDemoMode()) {
      const demoStore = useDemoStore.getState()
      const newBinome = demoStore.addBinome(data) as Binome
      set(state => ({
        binomes: [...state.binomes, newBinome],
        loading: false
      }))

      // Log creation en mode demo
      await loggingService.logCreate('binome', newBinome.Id || newBinome.id || '', newBinome.binome_name, {
        username: newBinome.username,
        binome_name: newBinome.binome_name,
        assigned_zone: newBinome.assigned_zone,
        is_admin: newBinome.is_admin
      })

      return newBinome
    }

    set({ loading: true, error: null })
    try {
      if (!apiService.isReady) {
        await apiService.init()
      }
      if (!apiService.config) throw new Error('API non configuree')

      const newBinome = await apiService.create<Binome>(
        apiService.config.tables.binomes,
        {
          ...data,
          is_admin: data.is_admin ? 1 : 0
        }
      )

      set(state => ({
        binomes: [...state.binomes, newBinome],
        loading: false
      }))

      // Log creation
      await loggingService.logCreate('binome', newBinome.Id || newBinome.id || '', newBinome.binome_name, {
        username: newBinome.username,
        binome_name: newBinome.binome_name,
        assigned_zone: newBinome.assigned_zone,
        is_admin: newBinome.is_admin
      })

      return newBinome
    } catch (error) {
      const message = (error as Error).message || 'Erreur lors de la creation du binome'
      set({ error: message, loading: false })
      throw error
    }
  },

  updateBinome: async (id: string, data: Partial<Binome>) => {
    // Capturer les anciennes valeurs AVANT la modification
    const oldBinome = get().binomes.find(b => b.Id === id || b.id === id)
    const oldValues = oldBinome ? {
      binome_name: oldBinome.binome_name,
      assigned_zone: oldBinome.assigned_zone,
      is_admin: oldBinome.is_admin
    } : {}

    // Mode démo : modifier localement uniquement
    if (isDemoMode()) {
      const demoStore = useDemoStore.getState()
      demoStore.updateBinome(id, data)
      set(state => ({
        binomes: state.binomes.map(b =>
          (b.Id === id || b.id === id) ? { ...b, ...data } : b
        ),
        loading: false
      }))

      // Log modification en mode demo
      await loggingService.logUpdate('binome', id, oldBinome?.binome_name || id, oldValues, data)

      return { ...data, id } as Binome
    }

    set({ loading: true, error: null })
    try {
      if (!apiService.isReady) {
        await apiService.init()
      }
      if (!apiService.config) throw new Error('API non configuree')

      const updateData = {
        ...data,
        is_admin: data.is_admin !== undefined ? (data.is_admin ? 1 : 0) : undefined
      }

      const updatedBinome = await apiService.update<Binome>(
        apiService.config.tables.binomes,
        id,
        updateData
      )

      set(state => ({
        binomes: state.binomes.map(b =>
          (b.Id === id || b.id === id) ? { ...b, ...updatedBinome } : b
        ),
        loading: false
      }))

      // Log modification
      await loggingService.logUpdate('binome', id, oldBinome?.binome_name || id, oldValues, data)

      return updatedBinome
    } catch (error) {
      const message = (error as Error).message || 'Erreur lors de la mise a jour du binome'
      set({ error: message, loading: false })
      throw error
    }
  },

  deleteBinome: async (id: string) => {
    // Capturer les anciennes valeurs AVANT la suppression
    const oldBinome = get().binomes.find(b => b.Id === id || b.id === id)
    const oldValues = oldBinome ? {
      username: oldBinome.username,
      binome_name: oldBinome.binome_name,
      assigned_zone: oldBinome.assigned_zone
    } : {}

    // Mode démo : supprimer localement uniquement
    if (isDemoMode()) {
      const demoStore = useDemoStore.getState()
      demoStore.deleteBinome(id)
      set(state => ({
        binomes: state.binomes.filter(b => b.Id !== id && b.id !== id),
        loading: false
      }))

      // Log suppression en mode demo
      await loggingService.logDelete('binome', id, oldBinome?.binome_name || id, oldValues)

      return
    }

    set({ loading: true, error: null })
    try {
      if (!apiService.isReady) {
        await apiService.init()
      }
      if (!apiService.config) throw new Error('API non configuree')

      await apiService.delete(apiService.config.tables.binomes, id)

      set(state => ({
        binomes: state.binomes.filter(b => b.Id !== id && b.id !== id),
        loading: false
      }))

      // Log suppression
      await loggingService.logDelete('binome', id, oldBinome?.binome_name || id, oldValues)
    } catch (error) {
      const message = (error as Error).message || 'Erreur lors de la suppression du binome'
      set({ error: message, loading: false })
      throw error
    }
  },

  getBinomeById: (id: string) => {
    return get().binomes.find(b => b.Id === id || b.id === id)
  },

  getBinomeByUsername: (username: string) => {
    return get().binomes.find(b => b.username === username)
  }
}))
