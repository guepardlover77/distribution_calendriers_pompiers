/**
 * Service API pour React
 * Basé sur le ApiService Vue existant
 */

interface ApiConfig {
  baseUrl: string
  apiToken: string
  tables: {
    distributions: string
    zones: string
    binomes: string
  }
}

interface TableInfo {
  id: string
  title: string
}

interface User {
  Id?: string
  id?: string
  username: string
  password: string
  binome_name: string
  assigned_zone: string
  is_admin: boolean | number | string
  last_login?: string
}

class ApiService {
  config: ApiConfig | null = null
  projectId: string | null = null
  tables: Record<string, TableInfo> = {}
  isReady: boolean = false
  isProxyMode: boolean = false

  async init(): Promise<boolean> {
    this.config = {
      baseUrl: import.meta.env.VITE_NOCODB_BASE_URL || 'http://localhost:8080',
      apiToken: import.meta.env.VITE_NOCODB_API_TOKEN || '',
      tables: {
        distributions: 'Distributions',
        zones: 'Zones',
        binomes: 'Binomes'
      }
    }

    try {
      await this.fetchProjectInfo()
      this.isReady = true
      console.log('[ApiService] Initialized')
      return true
    } catch (error) {
      console.error('[ApiService] Init error:', error)
      return false
    }
  }

  async fetchProjectInfo(): Promise<void> {
    const response = await this.request<{ list: Array<{ id: string }> }>('/api/v1/db/meta/projects/', { method: 'GET' })
    this.projectId = response.list?.[0]?.id ?? null

    if (!this.projectId) {
      throw new Error('No project found')
    }

    const tablesResponse = await this.request<{ list: TableInfo[] }>(
      `/api/v1/db/meta/projects/${this.projectId}/tables`,
      { method: 'GET' }
    )

    if (tablesResponse.list) {
      for (const table of tablesResponse.list) {
        this.tables[table.title] = table
      }
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.config) {
      throw new Error('ApiService not initialized')
    }

    const url = `${this.config.baseUrl}${endpoint}`

    // Ne pas envoyer le token si on utilise le proxy Cloudflare (il l'ajoute automatiquement)
    const isProxyMode = this.config.baseUrl.includes('workers.dev')

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(isProxyMode ? {} : { 'xc-token': this.config.apiToken }),
      ...options.headers
    }

    console.log('[ApiService] Request:', options.method || 'GET', url)

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[ApiService] Error response:', response.status, errorText)
      throw new Error(`API Error: ${response.status} - ${errorText}`)
    }

    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return await response.json()
    }

    return await response.text() as unknown as T
  }

  async list<T>(tableName: string, options: { where?: string; limit?: number; offset?: number } = {}): Promise<T[]> {
    const { where, limit = 1000, offset = 0 } = options
    let endpoint = `/api/v1/db/data/noco/${this.projectId}/${tableName}?limit=${limit}&offset=${offset}`

    if (where) {
      endpoint += `&where=${encodeURIComponent(where)}`
    }

    const response = await this.request<{ list: T[] }>(endpoint, { method: 'GET' })
    return response.list || []
  }

  async get<T>(tableName: string, id: string): Promise<T> {
    const endpoint = `/api/v1/db/data/noco/${this.projectId}/${tableName}/${id}`
    return await this.request<T>(endpoint, { method: 'GET' })
  }

  async create<T>(tableName: string, data: Partial<T>): Promise<T> {
    const endpoint = `/api/v1/db/data/noco/${this.projectId}/${tableName}`
    console.log('[ApiService] CREATE request to:', endpoint)
    console.log('[ApiService] Data:', JSON.stringify(data, null, 2))
    const result = await this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    })
    console.log('[ApiService] CREATE response:', result)
    return result
  }

  async update<T>(tableName: string, id: string, data: Partial<T>): Promise<T> {
    const endpoint = `/api/v1/db/data/noco/${this.projectId}/${tableName}/${id}`
    return await this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  }

  async delete(tableName: string, id: string): Promise<void> {
    const endpoint = `/api/v1/db/data/noco/${this.projectId}/${tableName}/${id}`
    await this.request(endpoint, { method: 'DELETE' })
  }

  async findUserByUsername(username: string): Promise<User | null> {
    if (!this.config) return null
    const users = await this.list<User>(this.config.tables.binomes, {
      where: `(username,eq,${encodeURIComponent(username)})`
    })
    return users[0] || null
  }

  async updateLastLogin(userId: string): Promise<void> {
    if (!this.config) return
    await this.update(this.config.tables.binomes, userId, {
      last_login: new Date().toISOString()
    })
  }

  async getDistributions<T>(): Promise<T[]> {
    if (!this.config) return []
    return await this.list<T>(this.config.tables.distributions)
  }

  async getZones<T>(): Promise<T[]> {
    if (!this.config) return []
    return await this.list<T>(this.config.tables.zones)
  }

  async getBinomes(): Promise<User[]> {
    if (!this.config) return []
    return await this.list<User>(this.config.tables.binomes)
  }
}

export const apiService = new ApiService()
