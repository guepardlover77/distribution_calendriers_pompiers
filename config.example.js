/**
 * Configuration pour GitHub Pages
 *
 * Ce fichier contient UNIQUEMENT l'URL du worker Cloudflare (publique).
 * Le token API reste sécurisé dans Cloudflare Workers.
 *
 * Copiez ce fichier en 'config.js' et mettez l'URL de votre worker Cloudflare.
 */

const CONFIG = {
    // URL de votre Cloudflare Worker (proxy NocoDB)
    // Exemple: 'https://nocodb-proxy.votre-nom.workers.dev'
    proxyUrl: 'https://VOTRE_WORKER.workers.dev',

    // Noms des tables NocoDB
    tables: {
        distributions: 'Distributions',
        zones: 'Zones',
        binomes: 'Binomes'
    },

    // ID du projet NocoDB (optionnel)
    projectId: null
};

// Pour GitHub Pages, on peut aussi utiliser GitHub Secrets
// avec un workflow GitHub Actions pour injecter l'URL du worker
