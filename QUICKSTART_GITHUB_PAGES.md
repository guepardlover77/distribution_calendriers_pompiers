# 🚀 Démarrage rapide - GitHub Pages

Guide ultra-rapide pour déployer sur GitHub Pages en 5 minutes.

## 1️⃣ Déployer le Cloudflare Worker (2 min)

1. Allez sur [workers.cloudflare.com](https://workers.cloudflare.com/)
2. Créez un compte gratuit
3. **Create a Worker** → Nommez-le `nocodb-proxy`
4. **Edit Code** → Copiez le code de `cloudflare-worker/worker.js`
5. **Save and Deploy**
6. **Settings** → **Variables** :
   - Variable: `NOCODB_BASE_URL` = `http://100.72.210.25:8080`
   - Secret: `NOCODB_API_TOKEN` = votre token NocoDB
7. Notez l'URL : `https://nocodb-proxy.VOTRE-NOM.workers.dev`

## 2️⃣ Configurer l'application (1 min)

Créez `config.js` :

```javascript
const CONFIG = {
    proxyUrl: 'https://nocodb-proxy.VOTRE-NOM.workers.dev', // ← Votre URL Worker
    tables: {
        distributions: 'Distributions',
        zones: 'Zones',
        binomes: 'Binomes'
    },
    projectId: null
};
```

## 3️⃣ Modifier index.html (30 sec)

Cherchez la ligne :
```html
<script src="nocodb-config.js"></script>
```

Remplacez par :
```html
<script src="config.js"></script>
<script src="api-proxy.js"></script>
```

## 4️⃣ Activer GitHub Pages (1 min)

1. GitHub repo → **Settings** → **Pages**
2. Source: branche `main`, folder `/ (root)`
3. **Save**

## 5️⃣ Pousser sur GitHub (30 sec)

```bash
git add config.js
git commit -m "Configure for GitHub Pages"
git push origin main
```

## ✅ C'est fait !

Accédez à votre app : `https://VOTRE-USERNAME.github.io/VOTRE-REPO/`

---

## 🔧 Pour modifier l'app plus tard

```bash
# Faire vos modifications
git add .
git commit -m "Update app"
git push
```

GitHub Pages se met à jour automatiquement en ~1 minute.

---

## 📖 Pour plus de détails

Consultez [DEPLOY_GITHUB_PAGES.md](DEPLOY_GITHUB_PAGES.md)
