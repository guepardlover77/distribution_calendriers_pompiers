import { create } from 'zustand'
import { apiService } from '@/services/api'
import { storageService, SessionData } from '@/services/storage'

const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes

interface AuthState {
  currentUser: SessionData | null
  initialized: boolean
  lastActivity: number
  sessionTimeoutId: ReturnType<typeof setTimeout> | null
  isDemoMode: boolean

  // Getters
  isLoggedIn: () => boolean
  isAdmin: () => boolean
  userDisplayName: () => string

  // Actions
  initialize: () => Promise<void>
  login: (username: string, password: string) => Promise<SessionData>
  loginAsDemo: () => void
  logout: () => Promise<void>
  canAccessDistribution: (distribution: { binome_id?: string }) => boolean
  canAccessZone: (zone: { id?: string; name?: string; binome_id?: string }) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  initialized: false,
  lastActivity: Date.now(),
  sessionTimeoutId: null,
  isDemoMode: false,

  isLoggedIn: () => {
    const state = get()
    // Demo mode is always logged in
    if (state.isDemoMode && state.currentUser) return true
    if (!state.currentUser?.sessionExpiry) return false
    return new Date(state.currentUser.sessionExpiry) > new Date()
  },

  isAdmin: () => {
    return get().currentUser?.is_admin === true
  },

  userDisplayName: () => {
    return get().currentUser?.binome_name || ''
  },

  initialize: async () => {
    if (get().initialized) return

    try {
      const savedSession = await storageService.loadSession()

      if (savedSession && savedSession.sessionExpiry) {
        const expiry = new Date(savedSession.sessionExpiry)
        if (expiry > new Date()) {
          set({ currentUser: savedSession })
          setupSessionTimeout(set, get)
          setupActivityListeners(set, get)
        }
      }
    } catch (error) {
      console.error('[AuthStore] Erreur d\'initialisation:', error)
    } finally {
      set({ initialized: true })
    }
  },

  login: async (username: string, password: string) => {
    // Initialize API if needed
    if (!apiService.isReady) {
      await apiService.init()
    }

    // Find user
    const user = await apiService.findUserByUsername(username)

    if (!user) {
      throw new Error('Nom d\'utilisateur ou mot de passe incorrect')
    }

    // Check password
    if (user.password !== password) {
      throw new Error('Nom d\'utilisateur ou mot de passe incorrect')
    }

    // Update last_login
    const nocoId = user.Id || user.id
    if (nocoId) {
      await apiService.updateLastLogin(nocoId)
    }

    // Create session
    const sessionExpiry = new Date(Date.now() + SESSION_TIMEOUT)
    const isAdmin = user.is_admin === true || user.is_admin === 1 || user.is_admin === '1'

    const sessionUser: SessionData = {
      id: nocoId || '',
      username: user.username,
      binome_name: user.binome_name,
      assigned_zone: user.assigned_zone,
      is_admin: isAdmin,
      sessionExpiry: sessionExpiry.toISOString()
    }

    // Save session
    await storageService.saveSession(sessionUser)
    set({ currentUser: sessionUser })

    // Setup timeouts
    setupSessionTimeout(set, get)
    setupActivityListeners(set, get)

    return sessionUser
  },

  loginAsDemo: () => {
    // Create a demo session (admin view to see everything)
    const sessionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours for demo

    const demoUser: SessionData = {
      id: 'demo',
      username: 'demo',
      binome_name: 'Visiteur Demo',
      assigned_zone: '',
      is_admin: true, // Admin to see all features
      sessionExpiry: sessionExpiry.toISOString()
    }

    set({ currentUser: demoUser, isDemoMode: true, initialized: true })
  },

  logout: async () => {
    const state = get()
    if (state.sessionTimeoutId) {
      clearTimeout(state.sessionTimeoutId)
    }
    set({ currentUser: null, sessionTimeoutId: null, isDemoMode: false })
    await storageService.clearUserSession()
  },

  canAccessDistribution: (distribution) => {
    const state = get()
    if (state.isAdmin()) return true
    return distribution.binome_id === state.currentUser?.username
  },

  canAccessZone: (zone) => {
    const state = get()
    if (state.isAdmin()) return true
    return (
      zone.id === state.currentUser?.assigned_zone ||
      zone.name === state.currentUser?.assigned_zone ||
      zone.binome_id === state.currentUser?.username
    )
  }
}))

function setupSessionTimeout(
  set: (partial: Partial<AuthState>) => void,
  get: () => AuthState
) {
  const state = get()

  if (state.sessionTimeoutId) {
    clearTimeout(state.sessionTimeoutId)
  }

  if (!state.currentUser?.sessionExpiry) return

  const expiry = new Date(state.currentUser.sessionExpiry)
  const now = new Date()
  const timeUntilExpiry = expiry.getTime() - now.getTime()

  if (timeUntilExpiry > 0) {
    const timeoutId = setTimeout(async () => {
      await get().logout()
      window.dispatchEvent(new CustomEvent('session-expired'))
    }, timeUntilExpiry)
    set({ sessionTimeoutId: timeoutId })
  } else {
    get().logout()
  }
}

function setupActivityListeners(
  set: (partial: Partial<AuthState>) => void,
  get: () => AuthState
) {
  const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll']

  const onActivity = () => {
    const state = get()
    const now = Date.now()

    if (now - state.lastActivity < 60000) return

    set({ lastActivity: now })

    if (state.currentUser) {
      const newExpiry = new Date(now + SESSION_TIMEOUT)
      const updatedUser = {
        ...state.currentUser,
        sessionExpiry: newExpiry.toISOString()
      }
      set({ currentUser: updatedUser })
      storageService.saveSession(updatedUser)
      setupSessionTimeout(set, get)
    }
  }

  activityEvents.forEach(event => {
    document.addEventListener(event, onActivity, { passive: true })
  })
}
