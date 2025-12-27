export interface Log {
  // NocoDB identifiers
  Id?: string
  id?: string

  // Core log data
  timestamp: string
  action: LogAction
  entity_type: LogEntityType
  entity_id: string
  entity_name?: string

  // User info
  user_id: string
  user_name: string

  // Change tracking
  old_values?: string
  new_values?: string

  // Context info
  ip_address?: string
  user_agent?: string
  device_type?: string
  platform?: string
  session_duration?: number

  // Demo mode flag
  is_demo?: boolean
}

export type LogAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'login_demo'
  | 'logout_demo'

export type LogEntityType =
  | 'distribution'
  | 'zone'
  | 'binome'
  | 'session'

export interface LogFilters {
  dateFrom?: string
  dateTo?: string
  action?: LogAction | 'all'
  entityType?: LogEntityType | 'all'
  userId?: string | 'all'
  searchQuery?: string
}

// Labels for display
export const ACTION_LABELS: Record<LogAction, string> = {
  create: 'Creation',
  update: 'Modification',
  delete: 'Suppression',
  login: 'Connexion',
  logout: 'Deconnexion',
  login_demo: 'Connexion demo',
  logout_demo: 'Deconnexion demo'
}

export const ENTITY_LABELS: Record<LogEntityType, string> = {
  distribution: 'Distribution',
  zone: 'Zone',
  binome: 'Binome',
  session: 'Session'
}
