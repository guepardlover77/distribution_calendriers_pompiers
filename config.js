/**
 * Configuration pour GitHub Pages
 * Ce fichier contient uniquement l'URL du worker Cloudflare (publique)
 */

const CONFIG = {
    // URL de votre Cloudflare Worker (proxy NocoDB)
    proxyUrl: 'https://nocodb-proxy.cam137.workers.dev',

    // Noms des tables NocoDB
    tables: {
        distributions: 'Distributions',
        zones: 'Zones',
        binomes: 'Binomes'
    },

    // ID du projet NocoDB (optionnel)
    projectId: null
};
