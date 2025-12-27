/**
 * Service de logging centralise
 * Capture toutes les actions CRUD et connexions/deconnexions
 */

import { Capacitor } from '@capacitor/core'
import { Log, LogAction, LogEntityType } from '@/types/log'
import { apiService } from '@/services/api'

interface LogContext {
  userId: string
  userName: string
  sessionStartTime: number
  isDemoMode: boolean
}

interface DeviceInfo {
  userAgent: string
  deviceType: string
  platform: string
}

class LoggingService {
  private context: LogContext | null = null
  private deviceInfo: DeviceInfo | null = null
  private ipAddress: string | null = null

  /**
   * Configure le contexte utilisateur - appele depuis authStore apres login
   */
  setContext(userId: string, userName: string, isDemoMode: boolean): void {
    this.context = {
      userId,
      userName,
      sessionStartTime: Date.now(),
      isDemoMode
    }
    this.initDeviceInfo()
    this.fetchIpAddress()
  }

  /**
   * Nettoie le contexte - appele depuis authStore au logout
   */
  clearContext(): void {
    this.context = null
  }

  /**
   * Detecte les informations sur l'appareil
   */
  private initDeviceInfo(): void {
    const userAgent = navigator.userAgent
    const platform = Capacitor.getPlatform() // 'web', 'ios', 'android'

    let deviceType = 'desktop'
    if (/Mobi|Android/i.test(userAgent)) {
      deviceType = 'mobile'
    } else if (/Tablet|iPad/i.test(userAgent)) {
      deviceType = 'tablet'
    }

    this.deviceInfo = { userAgent, deviceType, platform }
  }

  /**
   * Recupere l'adresse IP du client via un service externe
   */
  private async fetchIpAddress(): Promise<void> {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      this.ipAddress = data.ip
    } catch (error) {
      console.warn('[LoggingService] Could not fetch IP address:', error)
      this.ipAddress = 'unknown'
    }
  }

  /**
   * Calcule la duree de session en secondes
   */
  private getSessionDuration(): number | undefined {
    if (!this.context?.sessionStartTime) return undefined
    return Math.floor((Date.now() - this.context.sessionStartTime) / 1000)
  }

  /**
   * Methode principale de logging
   */
  async log(
    action: LogAction,
    entityType: LogEntityType,
    entityId: string,
    entityName?: string,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>
  ): Promise<void> {
    // Skip si pas de contexte (pas connecte)
    if (!this.context) {
      console.warn('[LoggingService] No context set, skipping log')
      return
    }

    const logEntry: Partial<Log> = {
      timestamp: new Date().toISOString(),
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      user_id: this.context.userId,
      user_name: this.context.userName,
      old_values: oldValues ? JSON.stringify(oldValues) : undefined,
      new_values: newValues ? JSON.stringify(newValues) : undefined,
      ip_address: this.ipAddress || undefined,
      user_agent: this.deviceInfo?.userAgent,
      device_type: this.deviceInfo?.deviceType,
      platform: this.deviceInfo?.platform,
      session_duration: this.getSessionDuration(),
      is_demo: this.context.isDemoMode
    }

    // En mode demo, log local seulement (pas de persistance NocoDB)
    if (this.context.isDemoMode) {
      console.log('[LoggingService] Demo mode log:', logEntry)
      return
    }

    // Persister dans NocoDB
    try {
      if (apiService.isReady && apiService.config) {
        await apiService.create('Logs', logEntry)
        console.log('[LoggingService] Log created:', action, entityType, entityId)
      }
    } catch (error) {
      // Erreurs silencieuses pour ne pas perturber les operations
      console.error('[LoggingService] Failed to create log:', error)
    }
  }

  // Methodes de commodite

  async logCreate(
    entityType: LogEntityType,
    entityId: string,
    entityName: string,
    newValues: Record<string, unknown>
  ): Promise<void> {
    await this.log('create', entityType, entityId, entityName, undefined, newValues)
  }

  async logUpdate(
    entityType: LogEntityType,
    entityId: string,
    entityName: string,
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>
  ): Promise<void> {
    await this.log('update', entityType, entityId, entityName, oldValues, newValues)
  }

  async logDelete(
    entityType: LogEntityType,
    entityId: string,
    entityName: string,
    oldValues: Record<string, unknown>
  ): Promise<void> {
    await this.log('delete', entityType, entityId, entityName, oldValues, undefined)
  }

  async logLogin(userId: string, userName: string, isDemo: boolean = false): Promise<void> {
    // Configure le contexte pour cette session
    this.setContext(userId, userName, isDemo)

    await this.log(
      isDemo ? 'login_demo' : 'login',
      'session',
      userId,
      userName
    )
  }

  async logLogout(): Promise<void> {
    if (!this.context) return

    await this.log(
      this.context.isDemoMode ? 'logout_demo' : 'logout',
      'session',
      this.context.userId,
      this.context.userName
    )

    this.clearContext()
  }
}

export const loggingService = new LoggingService()
