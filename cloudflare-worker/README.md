# Cloudflare Worker - Proxy NocoDB

Ce worker agit comme un proxy sécurisé entre votre application GitHub Pages et votre instance NocoDB.

## 🎯 Objectif

Permettre l'hébergement de l'application sur GitHub Pages sans exposer le token API NocoDB.

## 📁 Fichiers

- `worker.js` - Code du worker Cloudflare
- `wrangler.toml` - Configuration pour le déploiement via Wrangler CLI (optionnel)
- `README.md` - Ce fichier

## 🚀 Déploiement rapide

### Via l'interface web Cloudflare

1. Allez sur [dash.cloudflare.com](https://dash.cloudflare.com/)
2. **Workers & Pages** → **Create Application** → **Create Worker**
3. Nommez le worker : `nocodb-proxy`
4. **Edit Code** → Copiez-collez le contenu de `worker.js`
5. **Save and Deploy**

### Configuration des secrets

Dans **Settings** → **Variables** :

**Environment Variables** :
- `NOCODB_BASE_URL` = `http://100.72.210.25:8080` (votre URL NocoDB)

**Secrets** :
- `NOCODB_API_TOKEN` = votre token API NocoDB

### Via Wrangler CLI (optionnel)

```bash
# Installer Wrangler
npm install -g wrangler

# Se connecter
wrangler login

# Configurer wrangler.toml
# Éditer le fichier et ajouter votre NOCODB_BASE_URL dans [vars]

# Ajouter le secret
wrangler secret put NOCODB_API_TOKEN

# Déployer
wrangler deploy
```

## 🧪 Test

```bash
# Remplacer VOTRE-NOM par le nom de votre worker
curl https://nocodb-proxy.VOTRE-NOM.workers.dev/api/v1/db/meta/projects/
```

Vous devriez recevoir la liste de vos projets NocoDB.

## 🔒 Sécurité

Le worker :
- ✅ Cache le token API NocoDB
- ✅ Gère CORS pour autoriser les requêtes depuis GitHub Pages
- ✅ Transmet toutes les requêtes API vers NocoDB de manière transparente
- ⚠️ Par défaut, autorise toutes les origines (`Access-Control-Allow-Origin: *`)

### Restreindre l'accès (recommandé en production)

Dans `worker.js`, modifiez :

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://VOTRE-USERNAME.github.io',
  // ... reste du code
};
```

## 📚 Documentation complète

Consultez [DEPLOY_GITHUB_PAGES.md](../DEPLOY_GITHUB_PAGES.md) pour le guide complet.
