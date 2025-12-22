/**
 * Service de stockage pour React
 * Compatible avec Capacitor Preferences
 */

import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'

const STORAGE_KEYS = {
  SESSION: 'pompiers_session',
  DISTRIBUTIONS: 'distributions',
  ZONES: 'mapZones'
} as const

export interface SessionData {
  id: string
  username: string
  binome_name: string
  assigned_zone: string
  is_admin: boolean
  sessionExpiry: string
}

export interface Distribution {
  id: string
  address: string
  lat: number
  lng: number
  status: 'effectue' | 'repasser' | 'refus'
  amount: number
  payment?: string
  payment_method?: string
  notes?: string
  binome_id: string
  createdAt: string
  updatedAt: string
  localId?: string
}

export interface Zone {
  id: string
  name: string
  binome_username?: string
}

class StorageService {
  private isNative: boolean

  constructor() {
    this.isNative = Capacitor.isNativePlatform()
  }

  async set(key: string, value: unknown): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value)

    if (this.isNative) {
      await Preferences.set({ key, value: stringValue })
    } else {
      localStorage.setItem(key, stringValue)
    }
  }

  async get<T>(key: string, defaultValue: T | null = null): Promise<T | null> {
    let value: string | null

    if (this.isNative) {
      const result = await Preferences.get({ key })
      value = result.value
    } else {
      value = localStorage.getItem(key)
    }

    if (value === null || value === undefined) {
      return defaultValue
    }

    try {
      return JSON.parse(value) as T
    } catch {
      return value as unknown as T
    }
  }

  async remove(key: string): Promise<void> {
    if (this.isNative) {
      await Preferences.remove({ key })
    } else {
      localStorage.removeItem(key)
    }
  }

  async clear(): Promise<void> {
    if (this.isNative) {
      await Preferences.clear()
    } else {
      localStorage.clear()
    }
  }

  // Business methods
  async saveDistributions(distributions: Distribution[]): Promise<void> {
    await this.set(STORAGE_KEYS.DISTRIBUTIONS, distributions)
  }

  async loadDistributions(): Promise<Distribution[]> {
    return await this.get<Distribution[]>(STORAGE_KEYS.DISTRIBUTIONS, []) ?? []
  }

  async saveZones(zones: Zone[]): Promise<void> {
    await this.set(STORAGE_KEYS.ZONES, zones)
  }

  async loadZones(): Promise<Zone[]> {
    return await this.get<Zone[]>(STORAGE_KEYS.ZONES, []) ?? []
  }

  async saveSession(session: SessionData): Promise<void> {
    await this.set(STORAGE_KEYS.SESSION, session)
  }

  async loadSession(): Promise<SessionData | null> {
    return await this.get<SessionData>(STORAGE_KEYS.SESSION, null)
  }

  async clearUserSession(): Promise<void> {
    await this.remove(STORAGE_KEYS.SESSION)
  }
}

export const storageService = new StorageService()
