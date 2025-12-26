import { create } from 'zustand'
import { apiService } from '@/services/api'
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

      return newBinome
    } catch (error) {
      const message = (error as Error).message || 'Erreur lors de la creation du binome'
      set({ error: message, loading: false })
      throw error
    }
  },

  updateBinome: async (id: string, data: Partial<Binome>) => {
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

      return updatedBinome
    } catch (error) {
      const message = (error as Error).message || 'Erreur lors de la mise a jour du binome'
      set({ error: message, loading: false })
      throw error
    }
  },

  deleteBinome: async (id: string) => {
    // Mode démo : supprimer localement uniquement
    if (isDemoMode()) {
      const demoStore = useDemoStore.getState()
      demoStore.deleteBinome(id)
      set(state => ({
        binomes: state.binomes.filter(b => b.Id !== id && b.id !== id),
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

      await apiService.delete(apiService.config.tables.binomes, id)

      set(state => ({
        binomes: state.binomes.filter(b => b.Id !== id && b.id !== id),
        loading: false
      }))
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
