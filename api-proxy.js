/**
 * API Proxy Helper
 *
 * Cette classe gère les appels API vers NocoDB via le proxy Cloudflare Worker
 * ou directement vers NocoDB en mode local.
 */

class NocoDBProxy {
    constructor(config) {
        this.config = config;
        this.useProxy = !!config.proxyUrl;
        this.baseUrl = this.useProxy ? config.proxyUrl : config.baseUrl;
        this.apiToken = config.apiToken; // Seulement utilisé en mode local
    }

    /**
     * Effectuer une requête API
     * @param {string} endpoint - Le endpoint API (ex: /api/v1/db/meta/projects/)
     * @param {Object} options - Options fetch (method, body, etc.)
     * @returns {Promise<any>}
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // En mode direct (local), ajouter le token
        if (!this.useProxy && this.apiToken) {
            headers['xc-token'] = this.apiToken;
        }

        const fetchOptions = {
            ...options,
            headers
        };

        try {
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error ${response.status}: ${errorText}`);
            }

            // Gérer les réponses vides
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            console.error('NocoDBProxy request error:', error);
            throw error;
        }
    }

    /**
     * GET request
     */
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    /**
     * POST request
     */
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * PATCH request
     */
    async patch(endpoint, data) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}
