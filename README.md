# Distribution Calendriers Pompiers

Application mobile et web pour la gestion de la distribution de calendriers des pompiers avec cartographie interactive et synchronisation NocoDB.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Ionic](https://img.shields.io/badge/Ionic-8.0-3880ff.svg)](https://ionicframework.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-6.0-119eff.svg)](https://capacitorjs.com/)

---

## Fonctionnalites

### Cartographie Interactive
- Carte en temps reel avec Leaflet et OpenStreetMap
- Marqueurs personnalises par statut (effectue, a repasser, refus)
- Geolocalisation automatique
- Creation et gestion de zones par dessin

### Gestion des Distributions
- Ajout rapide de distributions avec geocodage automatique
- Filtrage par statut, date, binome
- Historique complet des distributions
- Synchronisation avec NocoDB

### Statistiques
- Dashboard avec indicateurs cles
- Graphiques interactifs (Chart.js)
- Taux de reussite, montants, tendances

### Multi-utilisateurs
- Authentification securisee
- Gestion par binomes de pompiers
- Droits administrateur
- Zones attribuees par binome

### Application Mobile
- Interface Ionic optimisee mobile
- Build Android avec Capacitor
- Mode hors-ligne avec stockage local

---

## Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | React 18 + TypeScript |
| UI | Ionic Framework 8 |
| State | Zustand |
| Cartographie | Leaflet + Leaflet Draw |
| Graphiques | Chart.js |
| Build | Vite |
| Mobile | Capacitor 6 |
| Backend | NocoDB |
| Proxy API | Cloudflare Worker |

---

## Installation

### Prerequis

- Node.js 18+
- npm ou yarn
- Instance NocoDB configuree
- (Optionnel) Android Studio pour le build mobile

### Installation

```bash
# Cloner le projet
git clone https://github.com/guepardlover77/distribution_calendriers_pompiers.git
cd distribution_calendriers_pompiers/react-ionic-app

# Installer les dependances
npm install

# Configurer l'environnement
cp .env.example .env
# Editez .env avec vos parametres NocoDB

# Lancer en developpement
npm run dev
```

L'application est accessible sur http://localhost:5173

---

## Configuration

### Variables d'environnement

Creez un fichier `.env` dans `react-ionic-app/` :

```env
VITE_NOCODB_BASE_URL=https://votre-worker.workers.dev
VITE_NOCODB_API_TOKEN=votre-token-api
```

### Structure NocoDB

Creez 3 tables dans votre base NocoDB :

#### Table `Binomes`
| Colonne | Type | Description |
|---------|------|-------------|
| username | Text | Identifiant unique |
| password | Text | Mot de passe |
| binome_name | Text | Nom d'affichage |
| assigned_zone | Text | Zone attribuee |
| is_admin | Checkbox | Droits admin |

#### Table `Distributions`
| Colonne | Type | Description |
|---------|------|-------------|
| address | Text | Adresse complete |
| lat | Decimal | Latitude |
| lng | Decimal | Longitude |
| status | Select | effectue, repasser, refus |
| amount | Number | Montant en euros |
| payment | Text | Mode de paiement |
| binome_id | Text | Username du binome |
| notes | Long Text | Commentaires |

#### Table `Zones`
| Colonne | Type | Description |
|---------|------|-------------|
| name | Text | Nom de la zone |
| geojson | Long Text | Geometrie GeoJSON |
| color | Text | Couleur hex |
| binome_id | Text | Username du binome |
| binome_name | Text | Nom du binome |

---

## Cloudflare Worker

Le dossier `cloudflare-worker/` contient un proxy pour securiser les appels API NocoDB :

```bash
cd cloudflare-worker
npx wrangler deploy
```

Configurez les secrets dans Cloudflare :
- `NOCODB_BASE_URL` : URL de votre instance NocoDB
- `NOCODB_API_TOKEN` : Token API NocoDB

---

## Build Mobile (Android)

```bash
cd react-ionic-app

# Build de production
npm run build

# Synchroniser avec Capacitor
npx cap sync

# Ouvrir dans Android Studio
npx cap open android
```

Ou pour generer l'APK directement :

```bash
cd android
./gradlew assembleDebug
```

L'APK sera dans `android/app/build/outputs/apk/debug/`

---

## Structure du Projet

```
distribution_calendriers_pompiers/
├── react-ionic-app/          # Application principale
│   ├── src/
│   │   ├── components/       # Composants reutilisables
│   │   ├── pages/            # Pages de l'application
│   │   ├── stores/           # State management (Zustand)
│   │   ├── services/         # API et storage
│   │   ├── router/           # Configuration routes
│   │   └── theme/            # Styles et theming
│   ├── android/              # Projet Android (Capacitor)
│   └── dist/                 # Build de production
├── cloudflare-worker/        # Proxy API Cloudflare
├── LICENSE
└── README.md
```

---

## Utilisation

### Connexion
1. Connectez-vous avec vos identifiants binome
2. Les administrateurs ont acces a toutes les zones et fonctionnalites

### Carte
- Visualisez les distributions sur la carte
- Cliquez sur un marqueur pour voir les details
- Utilisez le bouton de geolocalisation pour centrer sur votre position

### Ajouter une distribution
1. Cliquez sur le bouton +
2. Recherchez une adresse ou utilisez la position actuelle
3. Selectionnez le statut et entrez les informations
4. Enregistrez

### Gestion des zones (Admin)
1. Activez le mode dessin sur la carte
2. Dessinez une zone (polygone ou rectangle)
3. Nommez la zone
4. Assignez un binome dans la page d'administration

---

## Contribution

Les contributions sont les bienvenues :

1. Forkez le projet
2. Creez une branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Committez vos changements (`git commit -m 'Ajout nouvelle fonctionnalite'`)
4. Pushez (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrez une Pull Request

---

## License

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de details.

---

Developpe pour faciliter la distribution des calendriers des pompiers.
