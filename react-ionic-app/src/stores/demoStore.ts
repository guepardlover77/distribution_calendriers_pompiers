import { create } from 'zustand'
import { Distribution } from '@/services/storage'
import {
  DEMO_DISTRIBUTIONS,
  DEMO_ZONES,
  DEMO_BINOMES,
  DemoZone,
  DemoBinome
} from '@/data/demoData'

interface DemoState {
  // État
  isDemoMode: boolean
  distributions: Distribution[]
  zones: DemoZone[]
  binomes: DemoBinome[]

  // Actions principales
  enterDemoMode: () => void
  exitDemoMode: () => void
  resetDemoData: () => void

  // CRUD Distributions (opérations locales)
  addDistribution: (dist: Partial<Distribution>) => Distribution
  updateDistribution: (id: string, updates: Partial<Distribution>) => void
  deleteDistribution: (id: string) => void

  // CRUD Zones (opérations locales)
  addZone: (zone: Partial<DemoZone>) => DemoZone
  updateZone: (id: string, updates: Partial<DemoZone>) => void
  deleteZone: (id: string) => void
  assignBinomeToZone: (zoneId: string, binomeId: string | null, binomeName: string | null) => void
  updateZoneColor: (zoneId: string, color: string) => void

  // CRUD Binomes (opérations locales)
  addBinome: (binome: Partial<DemoBinome>) => DemoBinome
  updateBinome: (id: string, updates: Partial<DemoBinome>) => void
  deleteBinome: (id: string) => void
}

export const useDemoStore = create<DemoState>((set) => ({
  isDemoMode: false,
  distributions: [],
  zones: [],
  binomes: [],

  enterDemoMode: () => {
    set({
      isDemoMode: true,
      distributions: [...DEMO_DISTRIBUTIONS],
      zones: [...DEMO_ZONES],
      binomes: [...DEMO_BINOMES]
    })
  },

  exitDemoMode: () => {
    set({
      isDemoMode: false,
      distributions: [],
      zones: [],
      binomes: []
    })
  },

  resetDemoData: () => {
    set({
      distributions: [...DEMO_DISTRIBUTIONS],
      zones: [...DEMO_ZONES],
      binomes: [...DEMO_BINOMES]
    })
  },

  // CRUD Distributions
  addDistribution: (dist) => {
    const newDist: Distribution = {
      id: `demo-dist-${Date.now()}`,
      address: dist.address || '',
      lat: dist.lat || 0,
      lng: dist.lng || 0,
      status: dist.status || 'effectue',
      amount: dist.amount || 0,
      payment_method: dist.payment_method,
      notes: dist.notes,
      binome_id: dist.binome_id || 'demo',
      recipient_name: dist.recipient_name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      localId: dist.localId
    }
    set(state => ({
      distributions: [...state.distributions, newDist]
    }))
    return newDist
  },

  updateDistribution: (id, updates) => {
    set(state => ({
      distributions: state.distributions.map(d =>
        d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
      )
    }))
  },

  deleteDistribution: (id) => {
    set(state => ({
      distributions: state.distributions.filter(d => d.id !== id)
    }))
  },

  // CRUD Zones
  addZone: (zone) => {
    const newZone: DemoZone = {
      Id: `demo-zone-${Date.now()}`,
      id: `demo-zone-${Date.now()}`,
      name: zone.name || 'Nouvelle Zone',
      color: zone.color || '#10b981',
      binome_id: zone.binome_id,
      binome_name: zone.binome_name,
      geojson: zone.geojson || ''
    }
    set(state => ({
      zones: [...state.zones, newZone]
    }))
    return newZone
  },

  updateZone: (id, updates) => {
    set(state => ({
      zones: state.zones.map(z =>
        (z.id === id || z.Id === id) ? { ...z, ...updates } : z
      )
    }))
  },

  deleteZone: (id) => {
    set(state => ({
      zones: state.zones.filter(z => z.id !== id && z.Id !== id)
    }))
  },

  assignBinomeToZone: (zoneId, binomeId, binomeName) => {
    set(state => ({
      zones: state.zones.map(z =>
        (z.id === zoneId || z.Id === zoneId)
          ? { ...z, binome_id: binomeId || undefined, binome_name: binomeName || undefined }
          : z
      )
    }))
  },

  updateZoneColor: (zoneId, color) => {
    set(state => ({
      zones: state.zones.map(z =>
        (z.id === zoneId || z.Id === zoneId) ? { ...z, color } : z
      )
    }))
  },

  // CRUD Binomes
  addBinome: (binome) => {
    const newBinome: DemoBinome = {
      Id: `demo-binome-${Date.now()}`,
      id: `demo-binome-${Date.now()}`,
      username: binome.username || '',
      password: '***',
      binome_name: binome.binome_name || '',
      assigned_zone: binome.assigned_zone || '',
      is_admin: binome.is_admin || false
    }
    set(state => ({
      binomes: [...state.binomes, newBinome]
    }))
    return newBinome
  },

  updateBinome: (id, updates) => {
    set(state => ({
      binomes: state.binomes.map(b =>
        (b.id === id || b.Id === id) ? { ...b, ...updates } : b
      )
    }))
  },

  deleteBinome: (id) => {
    set(state => ({
      binomes: state.binomes.filter(b => b.id !== id && b.Id !== id)
    }))
  }
}))

// Helper pour vérifier le mode démo depuis n'importe où
export const isDemoMode = () => useDemoStore.getState().isDemoMode
