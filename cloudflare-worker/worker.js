/**
 * Cloudflare Worker - Proxy sécurisé pour NocoDB
 *
 * Ce worker agit comme un proxy entre votre application GitHub Pages
 * et votre instance NocoDB, en cachant le token API.
 *
 * Configuration requise dans Cloudflare Workers:
 * - Environment Variable: NOCODB_BASE_URL (ex: http://100.72.210.25:8080)
 * - Secret: NOCODB_API_TOKEN (votre token API NocoDB)
 * - Optional: NOCODB_PROJECT_ID
 */

/**
 * Domaines autorisés pour CORS
 * Ajoutez vos domaines ici
 */
const ALLOWED_ORIGINS = [
  'https://guepardlover77.github.io',
  'http://localhost:3000',
  'http://localhost:5173',  // Vite dev server
  'http://localhost:8080',
  'http://localhost',       // Capacitor Android
  'http://127.0.0.1:5500', // Live Server VSCode
  'http://127.0.0.1:5173', // Vite dev server alt
  'capacitor://localhost',  // Capacitor Android
  'ionic://localhost',      // Ionic
  'https://localhost',      // Capacitor iOS
  'file://',                // Cordova/Capacitor file access
];

/**
 * Obtient les headers CORS en fonction de l'origine
 * @param {Request} request - La requête entrante
 * @returns {Object} Headers CORS
 */
function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';

  // Si pas d'origine (cas mobile/Capacitor), autoriser toutes les origines
  if (!origin) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, xc-token',
      'Access-Control-Max-Age': '86400',
    };
  }

  // Vérifier si l'origine est autorisée
  const isAllowed = ALLOWED_ORIGINS.some(allowed => {
    if (allowed.includes('*')) {
      // Wildcard matching
      const pattern = allowed.replace('*', '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return origin === allowed || origin.startsWith(allowed);
  });

  // Pour les apps mobiles, autoriser l'origine meme si pas dans la liste
  const isMobileApp = origin.startsWith('capacitor://') ||
                      origin.startsWith('ionic://') ||
                      origin.startsWith('file://') ||
                      origin === 'http://localhost' ||
                      origin === 'https://localhost';

  const allowedOrigin = (isAllowed || isMobileApp) ? origin : '*';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, xc-token',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': allowedOrigin !== '*' ? 'true' : 'false',
  };
}

// CORS headers (conservé pour compatibilité)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, xc-token',
  'Access-Control-Max-Age': '86400',
};

// Gérer les requêtes OPTIONS (preflight CORS)
function handleOptions(request) {
  return new Response(null, {
    headers: getCorsHeaders(request)
  });
}

// Fonction principale du worker
export default {
  async fetch(request, env) {
    // Gérer les requêtes OPTIONS (CORS preflight)
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    try {
      const url = new URL(request.url);

      // Extraire le path de l'API NocoDB depuis l'URL
      // Format attendu: https://votre-worker.workers.dev/api/v1/db/...
      const nocodbPath = url.pathname;

      // Vérifier que les variables d'environnement sont définies
      if (!env.NOCODB_BASE_URL || !env.NOCODB_API_TOKEN) {
        return new Response(JSON.stringify({
          error: 'Worker mal configuré. Veuillez définir NOCODB_BASE_URL et NOCODB_API_TOKEN'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Construire l'URL complète vers NocoDB
      const nocodbUrl = `${env.NOCODB_BASE_URL}${nocodbPath}${url.search}`;

      console.log(`Proxying request to: ${nocodbUrl}`);

      // Préparer les headers pour NocoDB
      const headers = new Headers(request.headers);
      headers.set('xc-token', env.NOCODB_API_TOKEN);
      headers.delete('host'); // Supprimer le host du client

      // Copier le body de la requête si présent
      let body = null;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        body = await request.text();
      }

      // Faire la requête vers NocoDB
      const nocodbResponse = await fetch(nocodbUrl, {
        method: request.method,
        headers: headers,
        body: body
      });

      // Récupérer la réponse de NocoDB
      const responseBody = await nocodbResponse.text();

      // Créer la réponse avec les headers CORS
      const dynamicCorsHeaders = getCorsHeaders(request);
      const response = new Response(responseBody, {
        status: nocodbResponse.status,
        statusText: nocodbResponse.statusText,
        headers: {
          ...dynamicCorsHeaders,
          'Content-Type': nocodbResponse.headers.get('Content-Type') || 'application/json'
        }
      });

      return response;

    } catch (error) {
      console.error('Worker error:', error);

      return new Response(JSON.stringify({
        error: 'Erreur du proxy',
        message: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request)
        }
      });
    }
  }
};
