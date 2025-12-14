# 🚒 Distribution Calendriers Pompiers

> Application web moderne pour gérer la distribution de calendriers des pompiers avec cartographie interactive, statistiques en temps réel et base de données NocoDB.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-brightgreen.svg)](https://www.docker.com/)
[![NocoDB](https://img.shields.io/badge/Database-NocoDB-orange.svg)](https://nocodb.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

<div align="center">
  <img src="docs/screenshots/demo.gif" alt="Demo" width="800"/>
</div>

---

## ✨ Fonctionnalités

### 🗺️ Cartographie Interactive
- ✅ Carte en temps réel avec **Leaflet** et **OpenStreetMap**
- ✅ Marqueurs personnalisés par statut (effectué 🟢, à repasser 🟠, refus 🔴)
- ✅ **Géolocalisation automatique** de l'utilisateur
- ✅ **Centrage automatique** sur la dernière distribution au chargement
- ✅ Outils de dessin pour définir des zones
- ✅ Recherche d'adresse intelligente avec géocodage (BAN API)

### 📊 Gestion des Distributions
- ✅ Ajout **rapide et intuitif** de distributions
- ✅ Filtrage avancé par statut, date, adresse
- ✅ Modification et suppression en un clic
- ✅ Historique complet de toutes les distributions
- ✅ Mode automatique (recherche) et manuel (coordonnées GPS)

### 📈 Statistiques et Analyses
- ✅ **Dashboard complet** avec graphiques interactifs (Chart.js)
- ✅ Indicateurs clés : taux de réussite, montants moyens, tendances
- ✅ Graphiques : répartition par statut, moyens de paiement, évolution temporelle
- ✅ Statistiques détaillées par binôme
- ✅ Export de données via NocoDB

### 👥 Multi-utilisateurs et Authentification
- ✅ Système d'**authentification sécurisé**
- ✅ Gestion par **binômes** de pompiers
- ✅ Droits **administrateur** pour gestion globale
- ✅ Vue personnalisée par utilisateur
- ✅ Isolation des données par binôme

### 📱 Interface Moderne et Responsive
- ✅ **Design mobile-first** avec bottom navigation bar
- ✅ Optimisé pour mobile, tablette et desktop
- ✅ **Icônes SVG modernes** (Lucide Icons)
- ✅ Thème épuré et professionnel (PaperMod inspired)
- ✅ Animations fluides et transitions CSS
- ✅ Mode sombre/clair avec variables CSS

### 💾 Base de Données NocoDB
- ✅ **NocoDB** comme backend no-code
- ✅ **PostgreSQL** pour la persistance des données
- ✅ Synchronisation en temps réel
- ✅ API REST automatique
- ✅ Backups faciles via Docker

---

## 🚀 Installation Rapide

### Prérequis

- [Docker](https://docs.docker.com/get-docker/) (20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (2.0+)
- Ports 80 et 8080 disponibles

### Installation en 3 commandes

```bash
# 1. Cloner le projet
git clone https://github.com/votre-username/distribution_calendriers_pompiers.git
cd distribution_calendriers_pompiers

# 2. Configurer l'environnement
cp .env.example .env
# Éditez .env et changez les mots de passe

# 3. Démarrer l'application
make install
# ou
docker-compose up -d
```

✅ **C'est tout !** L'application est accessible sur :
- 🌐 **Application web** : http://localhost
- ⚙️ **NocoDB (admin)** : http://localhost:8080

---

## 📖 Configuration Initiale

### 1. Configurer NocoDB

Accédez à http://localhost:8080 et :

1. **Créez un compte administrateur**
2. **Créez une nouvelle base de données**
3. **Créez les 3 tables nécessaires** :

#### Table `Binomes` (Utilisateurs)
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | Auto Number | Clé primaire |
| `binome_name` | Single Line Text | Nom du binôme |
| `username` | Single Line Text | Identifiant de connexion (unique) |
| `password` | Single Line Text | Mot de passe |
| `is_admin` | Checkbox | Droits administrateur (default: false) |

#### Table `Distributions`
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | Auto Number | Clé primaire |
| `binome_id` | Number | ID du binôme (Foreign Key) |
| `binome_name` | Single Line Text | Nom du binôme |
| `address` | Single Line Text | Adresse complète |
| `lat` | Decimal | Latitude GPS |
| `lng` | Decimal | Longitude GPS |
| `status` | Single Select | effectue, repasser, refus |
| `amount` | Currency | Montant en € |
| `payment_method` | Single Select | especes, cheques |
| `notes` | Long Text | Notes et commentaires |
| `createdAt` | DateTime | Date création (auto) |
| `updatedAt` | DateTime | Date modification (auto) |

#### Table `Zones` (Optionnel)
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | Auto Number | Clé primaire |
| `binome_id` | Number | ID du binôme |
| `name` | Single Line Text | Nom de la zone |
| `geojson` | Long Text | Données GeoJSON |
| `color` | Single Line Text | Couleur hexadécimale |
| `createdAt` | DateTime | Date création |

### 2. Générer le Token API

Dans NocoDB :
1. Allez dans **Settings** (roue dentée)
2. Cliquez sur **API Tokens**
3. Créez un nouveau token
4. **Copiez le token**

### 3. Configurer l'Application

Éditez le fichier `nocodb-config.js` :

```javascript
const NOCODB_CONFIG = {
    baseUrl: 'http://localhost:8080',  // URL de NocoDB
    apiToken: 'COLLEZ_VOTRE_TOKEN_ICI',  // Token généré
    projectId: null,  // Auto-détecté
    tables: {
        distributions: 'Distributions',
        zones: 'Zones',
        binomes: 'Binomes'
    }
};
```

### 4. Redémarrer l'application

```bash
make restart
```

🎉 **Votre application est prête !**

---

## 🎮 Utilisation

### Interface Principale

L'interface utilise une **barre de navigation en bas** avec 4 onglets :

| Icône | Onglet | Description |
|-------|--------|-------------|
| ➕ | **Ajouter** | Ouvrir le formulaire d'ajout de distribution |
| 🗺️ | **Carte** | Afficher la carte interactive (par défaut) |
| 📋 | **Liste** | Voir toutes les distributions avec filtres |
| 📊 | **Stats** | Dashboard statistiques et graphiques |

### Ajouter une Distribution

1. Cliquez sur le bouton **➕ Ajouter**
2. **Mode automatique** : Recherchez une adresse (la géolocalisation se fait automatiquement)
3. **Mode manuel** : Saisissez les coordonnées GPS manuellement
4. Sélectionnez le **statut** (Effectué, À repasser, Refus)
5. Indiquez le **montant** et le **moyen de paiement**
6. Ajoutez des **notes** si nécessaire
7. Cliquez sur **Enregistrer**

### Filtrer les Distributions

Dans l'onglet **📋 Liste** :
- Filtrez par **statut** (Toutes, Effectué, À repasser, Refus)
- Filtrez par **date** (Du / Au)
- **Recherchez** par adresse

### Consulter les Statistiques

Dans l'onglet **📊 Stats** :
- Visualisez les **indicateurs clés** (totaux, taux de réussite)
- Analysez les **graphiques** (répartition, évolution)
- Consultez les **statistiques détaillées**

---

## 🛠️ Commandes Utiles

Le projet inclut un **Makefile** pour simplifier les opérations courantes :

```bash
make help          # Afficher toutes les commandes disponibles
make start         # Démarrer les services
make stop          # Arrêter les services
make restart       # Redémarrer les services
make logs          # Voir les logs en temps réel
make status        # Afficher le statut des services
make backup        # Sauvegarder la base de données
make restore       # Restaurer une sauvegarde (FILE=backup.sql)
make update        # Mettre à jour les images et redémarrer
make clean         # Nettoyer les conteneurs inutilisés
```

### Exemples d'utilisation

```bash
# Voir les logs de l'application
make logs-webapp

# Sauvegarder la base de données
make backup

# Restaurer une sauvegarde
make restore FILE=backups/backup-20231215.sql

# Réinitialiser complètement (⚠️ supprime les données)
make clean-all
```

---

## 🏗️ Architecture

### Stack Technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| **Frontend** | HTML5, CSS3, JavaScript (Vanilla) | - |
| **Cartographie** | Leaflet | 1.9.4 |
| **Outils dessin** | Leaflet Draw | 1.0.4 |
| **Graphiques** | Chart.js | 4.4.1 |
| **Icônes** | Lucide Icons | Latest |
| **Backend** | NocoDB | Latest |
| **Base de données** | PostgreSQL | 15 |
| **Serveur web** | Nginx | Alpine |
| **Conteneurisation** | Docker & Docker Compose | - |

### Schéma d'Architecture

```
┌──────────────────┐
│   Utilisateur    │
│   (Navigateur)   │
└────────┬─────────┘
         │ HTTP:80
         │
┌────────▼─────────┐
│  Nginx (webapp)  │
│   HTML/CSS/JS    │
└────────┬─────────┘
         │ HTTP:8080
         │
┌────────▼─────────┐
│     NocoDB       │
│   (API REST)     │
└────────┬─────────┘
         │ PostgreSQL:5432
         │
┌────────▼─────────┐
│   PostgreSQL     │
│  (Persistance)   │
└──────────────────┘
```

### Structure du Projet

```
distribution_calendriers_pompiers/
├── 📄 index.html              # Page principale
├── 📜 app.js                  # Logique application (3000+ lignes)
├── 🎨 style.css               # Styles CSS (1900+ lignes)
├── ⚙️ nocodb-config.js        # Configuration NocoDB
├── 🐳 docker-compose.yml      # Configuration Docker
├── 🌐 nginx.conf              # Configuration Nginx
├── 🔧 Makefile                # Commandes automatisées
├── 📋 .env.example            # Template variables d'environnement
├── 🚫 .dockerignore           # Exclusions Docker
├── 🚫 .gitignore              # Exclusions Git
├── 📖 README.md               # Ce fichier
├── 📚 DEPLOYMENT.md           # Guide de déploiement détaillé
└── 📁 docs/                   # Documentation supplémentaire
    └── archive/               # Anciens fichiers archivés
```

---

## 🌐 Déploiement en Production

### Sur un VPS (Recommandé)

```bash
# 1. Installer Docker sur le serveur
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 2. Cloner et configurer
git clone https://github.com/votre-username/distribution_calendriers_pompiers.git
cd distribution_calendriers_pompiers
cp .env.example .env
nano .env  # Modifiez les mots de passe

# 3. Démarrer
make start
```

### Avec HTTPS (Caddy)

Pour activer HTTPS automatiquement avec Let's Encrypt, ajoutez Caddy au `docker-compose.yml` :

```yaml
caddy:
  image: caddy:2-alpine
  restart: unless-stopped
  ports:
    - "443:443"
    - "80:80"
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile
    - caddy_data:/data
  networks:
    - calendriers_network
```

Créez un `Caddyfile` :

```
votre-domaine.com {
    reverse_proxy webapp:80
}
```

📖 **Guide complet** : Voir [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🔒 Sécurité

### Bonnes Pratiques

- ✅ **Changez TOUS les mots de passe** dans `.env` avant de déployer
- ✅ **Utilisez HTTPS** en production (Caddy, Traefik, Let's Encrypt)
- ✅ **Configurez un firewall** (UFW, iptables)
- ✅ **Ne commitez jamais** `.env` ou `nocodb-config.js` (ils sont dans `.gitignore`)
- ✅ **Effectuez des backups réguliers** (automatisables avec cron)
- ✅ **Mettez à jour les images Docker** régulièrement

### Sauvegardes Automatiques

```bash
# Ajouter au crontab
crontab -e

# Sauvegarde quotidienne à 2h du matin
0 2 * * * cd /chemin/vers/projet && make backup
```

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Voici comment contribuer :

1. **Forkez** le projet
2. **Créez** une branche feature (`git checkout -b feature/AmazingFeature`)
3. **Committez** vos changements (`git commit -m 'Add: Amazing feature'`)
4. **Pushez** vers la branche (`git push origin feature/AmazingFeature`)
5. **Ouvrez** une Pull Request

### Convention de commits

- `Add:` Nouvelle fonctionnalité
- `Fix:` Correction de bug
- `Update:` Mise à jour de fonctionnalité existante
- `Docs:` Documentation
- `Style:` Formatage, CSS
- `Refactor:` Refactorisation de code

---

## 📄 License

Ce projet est sous licence **MIT**. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

```
MIT License - Copyright (c) 2024

Vous êtes libre d'utiliser, modifier et distribuer ce logiciel.
```

---

## 🙏 Remerciements

Un grand merci aux projets open-source suivants :

- [Leaflet](https://leafletjs.com/) - Bibliothèque de cartographie
- [NocoDB](https://nocodb.com/) - Backend no-code
- [Chart.js](https://www.chartjs.org/) - Graphiques interactifs
- [Lucide Icons](https://lucide.dev/) - Icônes SVG modernes
- [OpenStreetMap](https://www.openstreetmap.org/) - Données cartographiques
- [Docker](https://www.docker.com/) - Conteneurisation

---

## 📞 Support

Besoin d'aide ? Plusieurs options s'offrent à vous :

- 📖 **Documentation** : Consultez [DEPLOYMENT.md](DEPLOYMENT.md) pour le guide complet
- 🐛 **Bug report** : [Ouvrir une issue](https://github.com/votre-username/distribution_calendriers_pompiers/issues)
- 💬 **Discussions** : [GitHub Discussions](https://github.com/votre-username/distribution_calendriers_pompiers/discussions)
- 📧 **Email** : support@example.com

---

## 🎯 Roadmap

### Version actuelle : 2.0

**Fonctionnalités prévues** :

- [ ] Mode hors-ligne complet (Service Worker)
- [ ] Notifications push pour les distributions
- [ ] Export PDF des statistiques
- [ ] Application mobile (PWA)
- [ ] Mode collaboratif temps réel (WebSockets)
- [ ] Système de rapports automatiques
- [ ] Intégration calendrier (Google Calendar, Outlook)
- [ ] Multi-langues (i18n)

---

## ⭐ Showcase

Si vous utilisez cette application, n'hésitez pas à :
- ⭐ **Donner une étoile** sur GitHub
- 📸 Partager vos **screenshots**
- 💬 Laisser un **témoignage**

---

<div align="center">

**Développé avec ❤️ pour faciliter la distribution des calendriers des pompiers** 🚒

**Bonne distribution !** 📅

[![Star on GitHub](https://img.shields.io/github/stars/votre-username/distribution_calendriers_pompiers?style=social)](https://github.com/votre-username/distribution_calendriers_pompiers)

</div>
