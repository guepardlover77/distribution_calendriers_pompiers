# 🚀 Déploiement sur GitHub Pages avec Cloudflare Workers

Ce guide vous explique comment déployer votre application sur GitHub Pages tout en gardant votre token NocoDB sécurisé grâce à Cloudflare Workers.

## 📋 Vue d'ensemble

L'architecture est la suivante :

```
[GitHub Pages]  ──(HTTPS)──>  [Cloudflare Worker]  ──(HTTP/HTTPS)──>  [NocoDB]
   (Frontend)                    (Proxy sécurisé)                      (Base de données)
```

- **GitHub Pages** : Héberge votre frontend (HTML/CSS/JS) - GRATUIT
- **Cloudflare Workers** : Proxy API qui cache le token NocoDB - GRATUIT
- **NocoDB** : Votre base de données (peut rester sur votre serveur local ou distant)

## 🔐 Avantages de cette solution

✅ Token NocoDB **jamais exposé** dans le code frontend
✅ Hébergement **100% gratuit** (GitHub Pages + Cloudflare Free tier)
✅ Accessible depuis **n'importe où** sur Internet
✅ **Facile à mettre à jour** (git push suffit)

---

## 📦 Étape 1 : Déployer le Cloudflare Worker

### 1.1 Créer un compte Cloudflare

1. Allez sur [cloudflare.com](https://www.cloudflare.com/)
2. Créez un compte gratuit
3. Vérifiez votre email

### 1.2 Installer Wrangler CLI (optionnel)

Si vous voulez déployer via la ligne de commande :

```bash
npm install -g wrangler
wrangler login
```

### 1.3 Déployer le Worker

#### Option A : Via l'interface web Cloudflare (plus simple)

1. Connectez-vous à [dash.cloudflare.com](https://dash.cloudflare.com/)
2. Allez dans **Workers & Pages**
3. Cliquez sur **Create Application** → **Create Worker**
4. Donnez un nom : `nocodb-proxy` (ou autre)
5. Cliquez sur **Deploy**
6. Cliquez sur **Edit Code**
7. Remplacez tout le code par le contenu du fichier `cloudflare-worker/worker.js`
8. Cliquez sur **Save and Deploy**
9. Notez l'URL de votre worker : `https://nocodb-proxy.VOTRE-NOM.workers.dev`

#### Option B : Via Wrangler CLI

```bash
cd cloudflare-worker
wrangler deploy
```

### 1.4 Configurer les secrets du Worker

Dans le dashboard Cloudflare :

1. Allez dans votre Worker → **Settings** → **Variables**
2. Ajoutez les **Environment Variables** suivantes :

   **Variable** : `NOCODB_BASE_URL`
   **Value** : `http://100.72.210.25:8080` (remplacez par votre URL NocoDB)

3. Ajoutez le **Secret** suivant :

   **Variable name** : `NOCODB_API_TOKEN`
   **Value** : Votre token API NocoDB (obtenu dans NocoDB → Account Settings → API Token)

4. Cliquez sur **Save**

Ou via Wrangler :

```bash
cd cloudflare-worker
wrangler secret put NOCODB_API_TOKEN
# Entrez votre token quand demandé

# Modifiez wrangler.toml pour ajouter NOCODB_BASE_URL
wrangler deploy
```

### 1.5 Tester le Worker

Testez que votre worker fonctionne :

```bash
curl https://nocodb-proxy.VOTRE-NOM.workers.dev/api/v1/db/meta/projects/
```

Vous devriez recevoir une réponse JSON avec vos projets NocoDB.

---

## 🌐 Étape 2 : Configurer l'application pour GitHub Pages

### 2.1 Créer le fichier de configuration

Créez un fichier `config.js` à la racine du projet :

```javascript
const CONFIG = {
    // URL de votre Cloudflare Worker
    proxyUrl: 'https://nocodb-proxy.VOTRE-NOM.workers.dev',

    // Noms des tables NocoDB
    tables: {
        distributions: 'Distributions',
        zones: 'Zones',
        binomes: 'Binomes'
    },

    // ID du projet NocoDB (optionnel)
    projectId: null
};
```

**Important** : Remplacez `VOTRE-NOM` par le nom de votre worker Cloudflare.

### 2.2 Ajouter config.js à Git

Contrairement à `nocodb-config.js`, le fichier `config.js` peut être commité car il ne contient pas de secrets :

```bash
git add config.js
git commit -m "Add production config for GitHub Pages"
```

### 2.3 Modifier index.html

Assurez-vous que `index.html` charge `config.js` au lieu de `nocodb-config.js` :

```html
<!-- Remplacer -->
<script src="nocodb-config.js"></script>

<!-- Par -->
<script src="config.js"></script>
<script src="api-proxy.js"></script>
```

### 2.4 Adapter app.js pour utiliser le proxy

Dans `app.js`, remplacez tous les appels directs à NocoDB par des appels via `NocoDBProxy`.

Exemple :

```javascript
// AVANT (appel direct)
const response = await fetch(
    `${NOCODB_CONFIG.baseUrl}/api/v1/db/meta/projects/`,
    { headers: { 'xc-token': NOCODB_CONFIG.apiToken } }
);

// APRÈS (via proxy)
const proxy = new NocoDBProxy(CONFIG);
const response = await proxy.get('/api/v1/db/meta/projects/');
```

---

## 📤 Étape 3 : Déployer sur GitHub Pages

### 3.1 Activer GitHub Pages

1. Allez dans votre repo GitHub
2. **Settings** → **Pages**
3. **Source** : Sélectionnez la branche `main` (ou `gh-pages`)
4. **Folder** : `/ (root)` ou `/docs` selon votre structure
5. Cliquez sur **Save**

### 3.2 Pousser votre code

```bash
git add .
git commit -m "Configure for GitHub Pages deployment"
git push origin main
```

### 3.3 Accéder à votre application

Votre application sera accessible à :

```
https://VOTRE-USERNAME.github.io/VOTRE-REPO/
```

Par exemple : `https://guepardlover77.github.io/distribution_calendriers_pompiers/`

---

## 🔄 Workflow de mise à jour

Pour mettre à jour votre application :

```bash
# Faire vos modifications
git add .
git commit -m "Description des changements"
git push origin main
```

GitHub Pages se met à jour automatiquement (peut prendre 1-2 minutes).

---

## 🛡️ Sécurité avancée (optionnel)

### Restreindre l'accès au Worker

Dans `cloudflare-worker/worker.js`, modifiez les CORS headers :

```javascript
const corsHeaders = {
  // Remplacer '*' par l'URL exacte de votre GitHub Pages
  'Access-Control-Allow-Origin': 'https://VOTRE-USERNAME.github.io',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

Cela empêchera d'autres sites d'utiliser votre worker.

### Ajouter une authentification au Worker

Vous pouvez ajouter une clé API simple dans le worker :

```javascript
// Dans worker.js
const API_KEY = env.FRONTEND_API_KEY; // Défini dans Cloudflare

// Vérifier la clé
const clientKey = request.headers.get('X-API-Key');
if (clientKey !== API_KEY) {
  return new Response('Unauthorized', { status: 401 });
}
```

Puis dans votre frontend :

```javascript
// Dans api-proxy.js
headers['X-API-Key'] = CONFIG.workerApiKey;
```

---

## 🐛 Dépannage

### L'application ne se connecte pas à NocoDB

1. Vérifiez que le Worker Cloudflare est déployé :
   ```bash
   curl https://nocodb-proxy.VOTRE-NOM.workers.dev/api/v1/db/meta/projects/
   ```

2. Vérifiez que `config.js` contient la bonne URL du worker

3. Ouvrez la console du navigateur (F12) pour voir les erreurs

### CORS errors

Si vous voyez des erreurs CORS :
- Vérifiez que le Worker a bien les headers CORS configurés
- Vérifiez que vous utilisez HTTPS (GitHub Pages et Cloudflare utilisent tous deux HTTPS)

### Le Worker ne trouve pas NocoDB

1. Vérifiez que `NOCODB_BASE_URL` est bien configuré dans Cloudflare
2. Vérifiez que votre serveur NocoDB est accessible depuis Internet
3. Si NocoDB est sur votre réseau local, utilisez un tunnel (ngrok, Cloudflare Tunnel, etc.)

---

## 💡 Alternatives

### Si NocoDB est sur votre réseau local

Vous devez exposer NocoDB à Internet. Options :

1. **Cloudflare Tunnel** (recommandé, gratuit) :
   ```bash
   cloudflared tunnel --url http://localhost:8080
   ```

2. **ngrok** (facile, version gratuite limitée) :
   ```bash
   ngrok http 8080
   ```

3. **Configuration port forwarding** sur votre routeur (plus complexe)

### Hébergement alternatif à GitHub Pages

Si vous préférez :
- **Netlify** : Déploiement automatique depuis GitHub, serverless functions incluses
- **Vercel** : Similaire à Netlify
- **Cloudflare Pages** : Intégration native avec Workers

---

## 📚 Ressources

- [Documentation GitHub Pages](https://docs.github.com/pages)
- [Documentation Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Documentation NocoDB](https://docs.nocodb.com/)

---

## ✅ Checklist finale

- [ ] Cloudflare Worker déployé et testé
- [ ] Variables d'environnement configurées dans Cloudflare
- [ ] `config.js` créé avec l'URL du Worker
- [ ] `index.html` modifié pour charger `config.js` et `api-proxy.js`
- [ ] GitHub Pages activé
- [ ] Application accessible via `https://VOTRE-USERNAME.github.io/VOTRE-REPO/`
- [ ] Test de connexion et de synchronisation NocoDB fonctionnel

**Félicitations !** Votre application est maintenant déployée de manière sécurisée ! 🎉
