# Configuration CI/CD - Build APK Automatique

## Fonctionnement

Le workflow GitHub Actions (`build-release.yml`) s'exécute automatiquement à chaque push sur la branche `main` ou `master` et :

1. Compile l'application React/Ionic
2. Synchronise avec Capacitor
3. Build l'APK Android (debug + release)
4. Crée une release GitHub avec :
   - Les fichiers APK téléchargeables
   - Le message du commit comme description
   - Un tag de version automatique

## Configuration Requise

### 1. Secrets GitHub (Optionnels)

Pour que l'application fonctionne avec votre backend NocoDB, configurez ces secrets :

1. Allez dans votre repo GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Cliquez sur **New repository secret**
3. Ajoutez les secrets suivants :

| Secret | Description | Exemple |
|--------|-------------|---------|
| `VITE_NOCODB_BASE_URL` | URL de votre Cloudflare Worker | `https://votre-worker.workers.dev` |
| `VITE_NOCODB_API_TOKEN` | Token API NocoDB | `xc-token-xxx...` |

> **Note** : Ces secrets sont optionnels. Sans eux, l'APK sera buildé mais l'app ne pourra pas se connecter au backend.

### 2. Permissions du Workflow

Le workflow a besoin de la permission `contents: write` pour créer des releases. Cette permission est déjà configurée dans le fichier YAML.

Si les releases ne se créent pas, vérifiez :
1. **Settings** → **Actions** → **General**
2. Section "Workflow permissions"
3. Sélectionnez "Read and write permissions"

## Structure des Releases

Chaque release contient :

### Fichiers APK

- `calendriers-pompiers-XXXXXX-debug.apk` : Version debug (recommandée pour tests)
- `calendriers-pompiers-XXXXXX-release-unsigned.apk` : Version release non signée

### Nommage des Tags

Les tags sont générés automatiquement au format : `v1.0.0-XXXXXX`
- `XXXXXX` = 7 premiers caractères du SHA du commit

### Corps de la Release

```
## Calendriers Pompiers - Build Automatique

**Commit:** `abc1234`
**Auteur:** Votre Nom
**Date:** 2025-03-15 10:30:00

### Description du commit

[Message du commit ici]
```

## Fichiers Ignorés

Les fichiers suivants ne déclenchent PAS de build :
- `*.md` (fichiers Markdown)
- `docs/**` (documentation)
- Fichiers marketing (`PLAN_ACTION_MARKETING.md`, etc.)

## Dépannage

### Le build échoue à "Install dependencies"

**Cause probable** : `package-lock.json` manquant ou désynchronisé

**Solution** :
```bash
cd react-ionic-app
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "fix: Update package-lock.json"
git push
```

### Le build échoue à "Build APK"

**Cause probable** : Problème de configuration Gradle

**Solutions** :
1. Vérifiez que le dossier `android/` est complet
2. Testez le build localement :
   ```bash
   cd react-ionic-app
   npm run build
   npx cap sync android
   cd android
   ./gradlew assembleDebug
   ```

### La release ne se crée pas

**Causes possibles** :
1. Permissions insuffisantes
2. Tag déjà existant (même commit)

**Solutions** :
1. Vérifiez les permissions dans Settings → Actions → General
2. Supprimez le tag existant si nécessaire :
   ```bash
   git tag -d v1.0.0-abc1234
   git push origin :refs/tags/v1.0.0-abc1234
   ```

### L'APK ne fonctionne pas (erreur réseau)

**Cause** : Secrets non configurés

**Solution** : Configurez `VITE_NOCODB_BASE_URL` et `VITE_NOCODB_API_TOKEN` dans les secrets GitHub

## Signer l'APK pour le Play Store

Pour publier sur Google Play, vous devez signer l'APK. Ajoutez ces étapes :

### 1. Créer un keystore

```bash
keytool -genkey -v -keystore calendriers-pompiers.keystore \
  -alias calendriers-pompiers -keyalg RSA -keysize 2048 -validity 10000
```

### 2. Ajouter les secrets de signature

| Secret | Description |
|--------|-------------|
| `KEYSTORE_BASE64` | Keystore encodé en base64 (`base64 -i calendriers-pompiers.keystore`) |
| `KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `KEY_ALIAS` | Alias de la clé (`calendriers-pompiers`) |
| `KEY_PASSWORD` | Mot de passe de la clé |

### 3. Modifier le workflow

Ajoutez ces étapes après "Build APK (Release unsigned)" :

```yaml
- name: Decode keystore
  run: |
    echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > keystore.jks

- name: Sign APK
  run: |
    jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
      -keystore keystore.jks \
      -storepass ${{ secrets.KEYSTORE_PASSWORD }} \
      -keypass ${{ secrets.KEY_PASSWORD }} \
      react-ionic-app/android/app/build/outputs/apk/release/app-release-unsigned.apk \
      ${{ secrets.KEY_ALIAS }}

- name: Align APK
  run: |
    zipalign -v 4 \
      react-ionic-app/android/app/build/outputs/apk/release/app-release-unsigned.apk \
      artifacts/calendriers-pompiers-${{ steps.commit_info.outputs.sha_short }}-release-signed.apk
```

## Exécution Manuelle

Vous pouvez déclencher le workflow manuellement :

1. Allez dans **Actions** → **Build APK & Release**
2. Cliquez sur **Run workflow**
3. Sélectionnez la branche
4. Cliquez sur **Run workflow**

Pour activer cette fonctionnalité, ajoutez au début du fichier YAML :

```yaml
on:
  push:
    branches: [main, master]
  workflow_dispatch:  # Ajouter cette ligne
```

## Notifications

Pour être notifié des builds, ajoutez une étape Slack ou Discord :

### Discord

```yaml
- name: Notify Discord
  if: success()
  uses: sarisia/actions-status-discord@v1
  with:
    webhook: ${{ secrets.DISCORD_WEBHOOK }}
    title: "Nouveau build disponible!"
    description: "APK version ${{ steps.tag.outputs.tag_name }}"
```

---

## Résumé des Commandes Utiles

```bash
# Build local
cd react-ionic-app
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug

# Vérifier le workflow
gh workflow view "Build APK & Release"

# Voir les runs récents
gh run list --workflow=build-release.yml

# Télécharger les artifacts
gh run download <run-id>
```
