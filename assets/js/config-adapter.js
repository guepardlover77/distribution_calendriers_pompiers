/**
 * Adaptateur de configuration
 *
 * Permet l'utilisation transparente du proxy Cloudflare (production)
 * ou de l'accès direct à NocoDB (développement local)
 */

// Détecter le mode : production (avec proxy) ou local (direct)
const USE_PROXY = typeof CONFIG !== 'undefined' && CONFIG.proxyUrl;

// Créer une configuration unifiée compatible avec le code existant
if (USE_PROXY) {
    console.log('🌐 Mode Production: Utilisation du proxy Cloudflare');

    // Créer l'instance du proxy
    window.nocoDBProxy = new NocoDBProxy(CONFIG);

    // Créer un objet NOCODB_CONFIG compatible pour le code existant
    window.NOCODB_CONFIG = {
        baseUrl: CONFIG.proxyUrl,
        apiToken: 'PROXY_MODE', // Valeur placeholder - le token réel est géré par le worker
        tables: CONFIG.tables,
        projectId: CONFIG.projectId,

        // Fonction helper pour faire des requêtes via le proxy
        async fetch(endpoint, options = {}) {
            // Supprimer l'en-tête xc-token car le worker l'ajoute
            if (options.headers) {
                delete options.headers['xc-token'];
            }

            // Construire l'URL complète
            const url = `${CONFIG.proxyUrl}${endpoint}`;

            // Faire la requête
            return fetch(url, options);
        }
    };

} else if (typeof NOCODB_CONFIG !== 'undefined') {
    console.log('🏠 Mode Développement Local: Accès direct à NocoDB');

    // Mode local - garder NOCODB_CONFIG tel quel
    // (déjà défini dans nocodb-config.js)

} else {
    console.error('❌ Configuration manquante!');
    console.error('Pour GitHub Pages: créez config.js avec l\'URL du worker');
    console.error('Pour développement local: créez nocodb-config.js avec les credentials NocoDB');

    // Créer un objet vide pour éviter les erreurs
    window.NOCODB_CONFIG = {
        baseUrl: '',
        apiToken: '',
        tables: {
            distributions: 'Distributions',
            zones: 'Zones',
            binomes: 'Binomes'
        }
    };
}

// Exposer le mode pour debug
window.NOCODB_MODE = USE_PROXY ? 'proxy' : 'direct';
console.log('Configuration NocoDB initialisée en mode:', window.NOCODB_MODE);
