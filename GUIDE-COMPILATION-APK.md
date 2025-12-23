# Guide de Compilation APK

Ce guide explique comment compiler l'application Android (fichier APK) à partir du code source.

## Prérequis

### 1. Installation de Node.js et npm
- Télécharger et installer Node.js (version LTS recommandée) depuis [nodejs.org](https://nodejs.org/)
- npm est installé automatiquement avec Node.js

### 2. Installation de Java JDK
- L'application nécessite Java 11 ou supérieur
- Si vous avez Android Studio installé, vous pouvez utiliser le JDK inclus :
  ```
  C:\Program Files\Android\Android Studio\jbr
  ```

### 3. Installation des dépendances du projet
```bash
cd react-ionic-app
npm install
```

## Étapes de Compilation

### 1. Build de l'application React/Vite
```bash
cd react-ionic-app
npm run build
```

Cette commande :
- Compile le code TypeScript
- Génère les fichiers optimisés dans le dossier `dist/`

### 2. Synchronisation avec Capacitor
```bash
npx cap sync android
```

Cette commande :
- Copie les fichiers web compilés vers le projet Android
- Met à jour les plugins Capacitor
- Prépare le projet Android pour la compilation

### 3. Compilation de l'APK
```bash
cd android
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew.bat assembleDebug
```

**Sur Windows (PowerShell) :**
```powershell
cd android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat assembleDebug
```

Cette commande génère l'APK debug dans :
```
android/app/build/outputs/apk/debug/app-debug.apk
```

## Commande Complète (Une seule ligne)

Depuis la racine du projet :
```bash
cd react-ionic-app && npm run build && npx cap sync android && cd android && JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew.bat assembleDebug
```

## Personnalisation de l'Icône

### 1. Préparer votre icône
- Format : PNG
- Taille recommandée : 1024x1024 px ou 512x512 px
- Fond transparent ou couleur unie

### 2. Placer l'icône
Copiez votre fichier `icon.png` dans :
```
react-ionic-app/resources/icon.png
```

### 3. Générer toutes les tailles
```bash
cd react-ionic-app
npx @capacitor/assets generate --android
```

Cette commande génère automatiquement :
- Toutes les résolutions d'icônes (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
- Les icônes adaptatives (avec foreground/background)
- Les écrans de démarrage (splash screens)

### 4. Recompiler l'APK
Suivez les étapes de compilation normales après avoir généré les icônes.

## Fichier APK Final

L'APK compilé se trouve à :
```
react-ionic-app/android/app/build/outputs/apk/debug/app-debug.apk
```

Pour l'installer sur un téléphone Android :
1. Transférer le fichier APK sur le téléphone
2. Ouvrir le fichier APK sur le téléphone
3. Autoriser l'installation depuis des sources inconnues si demandé
4. Installer l'application

## Variables d'Environnement

### Configuration de l'API (fichier `.env`)
```env
VITE_NOCODB_BASE_URL=https://nocodb-proxy.cam137.workers.dev
VITE_NOCODB_API_TOKEN=
```

Le token API est géré par le Cloudflare Worker et n'a pas besoin d'être défini ici.

## Résolution de Problèmes

### Erreur Java
Si vous obtenez une erreur liée à Java :
```
Error: JAVA_HOME is not set
```

Solution : Définir la variable JAVA_HOME :
```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
```

### Erreur de permissions
Sur Linux/Mac, rendre le script gradlew exécutable :
```bash
chmod +x android/gradlew
```

### Erreur de mémoire Gradle
Éditer `android/gradle.properties` et ajouter :
```properties
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m
```

## Build de Production (APK signé)

Pour créer un APK de production signé :

1. Créer un keystore :
```bash
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

2. Configurer `android/app/build.gradle` avec les informations de signature

3. Compiler l'APK release :
```bash
./gradlew.bat assembleRelease
```

## Notes Importantes

- **APK Debug** : Pour les tests, non optimisé, non signé
- **APK Release** : Pour la production, optimisé et signé
- La première compilation peut prendre plusieurs minutes
- Les compilations suivantes sont plus rapides grâce au cache Gradle

## Support

Pour tout problème, vérifier :
1. Les logs de compilation dans le terminal
2. Les fichiers de configuration (`.env`, `capacitor.config.ts`)
3. Les versions de Node.js, npm et Java
