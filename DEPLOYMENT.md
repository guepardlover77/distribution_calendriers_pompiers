# 🐳 Déploiement Docker - Application Distribution Calendriers Pompiers

Ce guide vous explique comment déployer l'application complète avec Docker Compose.

## 📋 Prérequis

- Docker installé (version 20.10+)
- Docker Compose installé (version 2.0+)
- Ports 80 et 8080 disponibles sur votre machine

## 🚀 Installation rapide

### 1. Cloner le projet (si pas déjà fait)

```bash
git clone <votre-repo>
cd distribution_calendriers_pompiers
```

### 2. Configurer les variables d'environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer le fichier .env et changer les mots de passe
nano .env  # ou vim, code, etc.
```

**⚠️ IMPORTANT** : Changez absolument ces valeurs en production :
- `NC_AUTH_JWT_SECRET` : Clé secrète pour JWT (utilisez une chaîne aléatoire longue)
- `POSTGRES_PASSWORD` : Mot de passe de la base de données

### 3. Lancer l'application

```bash
# Démarrer tous les services
docker-compose up -d

# Vérifier que tout fonctionne
docker-compose ps
```

Vous devriez voir 3 services en cours d'exécution :
- `calendriers_webapp` - Application web (port 80)
- `calendriers_nocodb` - NocoDB API (port 8080)
- `calendriers_postgres` - Base de données PostgreSQL

## 📱 Accéder à l'application

### Application web
- URL : **http://localhost**
- L'interface de distribution de calendriers

### Interface NocoDB (administration)
- URL : **http://localhost:8080**
- Créez un compte admin lors de la première visite
- Créez les tables nécessaires (voir section Configuration)

## ⚙️ Configuration NocoDB

### Première connexion

1. Ouvrez **http://localhost:8080**
2. Créez un compte administrateur
3. Créez une nouvelle base de données ou workspace

### Créer les tables nécessaires

L'application a besoin de 3 tables :

#### 1. Table "Binomes"
Colonnes :
- `id` (Auto Number, Primary Key)
- `binome_name` (Single Line Text, Required)
- `username` (Single Line Text, Required, Unique)
- `password` (Single Line Text, Required)
- `is_admin` (Checkbox, Default: false)

#### 2. Table "Distributions"
Colonnes :
- `id` (Auto Number, Primary Key)
- `binome_id` (Number, Foreign Key vers Binomes)
- `binome_name` (Single Line Text)
- `address` (Single Line Text)
- `lat` (Decimal)
- `lng` (Decimal)
- `status` (Single Select: effectue, repasser, refus)
- `amount` (Currency)
- `payment_method` (Single Select: especes, cheques)
- `notes` (Long Text)
- `createdAt` (DateTime, Auto Now on Create)
- `updatedAt` (DateTime, Auto Now on Update)

#### 3. Table "Zones" (optionnel)
Colonnes :
- `id` (Auto Number, Primary Key)
- `binome_id` (Number)
- `name` (Single Line Text)
- `geojson` (Long Text)
- `color` (Single Line Text)
- `createdAt` (DateTime)

### Générer le token API

1. Dans NocoDB, allez dans **Settings** (coin supérieur droit)
2. Cliquez sur **API Tokens**
3. Créez un nouveau token
4. Copiez le token généré

### Mettre à jour nocodb-config.js

Éditez le fichier `nocodb-config.js` :

```javascript
const NOCODB_CONFIG = {
    // URL de base de votre instance NocoDB
    baseUrl: 'http://localhost:8080',  // ou votre domaine en production

    // Collez votre token API ici
    apiToken: 'VOTRE_TOKEN_API_ICI',

    // Laissez null, sera auto-détecté
    projectId: null,

    // Noms des tables (doivent correspondre exactement)
    tables: {
        distributions: 'Distributions',
        zones: 'Zones',
        binomes: 'Binomes'
    }
};
```

## 🔧 Commandes utiles

### Démarrer les services
```bash
docker-compose up -d
```

### Arrêter les services
```bash
docker-compose down
```

### Voir les logs
```bash
# Tous les services
docker-compose logs -f

# Service spécifique
docker-compose logs -f webapp
docker-compose logs -f nocodb
docker-compose logs -f postgres
```

### Redémarrer un service
```bash
docker-compose restart webapp
docker-compose restart nocodb
```

### Mettre à jour l'application
```bash
# Arrêter les services
docker-compose down

# Mettre à jour le code (git pull, etc.)
git pull

# Redémarrer
docker-compose up -d
```

### Sauvegarder les données
```bash
# Sauvegarder la base de données
docker-compose exec postgres pg_dump -U nocodb nocodb > backup.sql

# Restaurer depuis une sauvegarde
docker-compose exec -T postgres psql -U nocodb nocodb < backup.sql
```

## 🌐 Déploiement en production

### Avec un nom de domaine

1. Modifiez le fichier `.env` :
```bash
NC_PUBLIC_URL=https://votre-domaine.com
```

2. Ajoutez un reverse proxy (Traefik, Caddy, ou nginx externe) pour HTTPS

### Exemple avec Caddy (HTTPS automatique)

Créez un `Caddyfile` :
```
votre-domaine.com {
    reverse_proxy webapp:80
}

api.votre-domaine.com {
    reverse_proxy nocodb:8080
}
```

Ajoutez Caddy au `docker-compose.yml` :
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
      - caddy_config:/config
    networks:
      - calendriers_network
```

## 🔒 Sécurité

### Recommandations pour la production :

1. **Changez tous les mots de passe par défaut**
2. **Utilisez HTTPS** (Let's Encrypt avec Caddy ou Traefik)
3. **Activez un firewall** (UFW, iptables)
4. **Limitez l'accès à PostgreSQL** (pas de port exposé publiquement)
5. **Backups réguliers** de la base de données
6. **Mettez à jour régulièrement** les images Docker

### Sauvegardes automatiques

Créez un cron job pour sauvegarder quotidiennement :

```bash
# Éditez le crontab
crontab -e

# Ajoutez cette ligne (sauvegarde tous les jours à 2h du matin)
0 2 * * * cd /chemin/vers/projet && docker-compose exec -T postgres pg_dump -U nocodb nocodb > backups/backup-$(date +\%Y\%m\%d).sql
```

## 📊 Monitoring

### Vérifier l'état de santé

```bash
# Voir les ressources utilisées
docker stats

# Vérifier l'espace disque
docker system df
```

### Nettoyer l'espace disque

```bash
# Nettoyer les images inutilisées
docker system prune -a

# Attention : ne supprime PAS les volumes de données
```

## ❓ Dépannage

### Les services ne démarrent pas
```bash
# Vérifier les logs
docker-compose logs

# Vérifier que les ports ne sont pas déjà utilisés
netstat -tulpn | grep :80
netstat -tulpn | grep :8080
```

### L'application ne se connecte pas à NocoDB
1. Vérifiez que le token API est correct dans `nocodb-config.js`
2. Vérifiez que NocoDB est accessible : http://localhost:8080
3. Regardez les logs : `docker-compose logs nocodb`

### Erreur de base de données
```bash
# Recréer la base de données (⚠️ PERTE DE DONNÉES)
docker-compose down -v
docker-compose up -d
```

### Réinitialiser complètement
```bash
# ⚠️ ATTENTION : Supprime TOUTES les données
docker-compose down -v
docker volume rm distribution_calendriers_pompiers_nocodb_data
docker volume rm distribution_calendriers_pompiers_postgres_data
docker-compose up -d
```

## 🆘 Support

En cas de problème :
1. Consultez les logs : `docker-compose logs -f`
2. Vérifiez la documentation NocoDB : https://docs.nocodb.com
3. Ouvrez une issue sur le repo GitHub

## 📝 Architecture

```
┌─────────────────┐
│   Utilisateur   │
└────────┬────────┘
         │
    (HTTP:80)
         │
┌────────▼────────┐
│  Nginx (webapp) │
│  Fichiers HTML  │
│   JS, CSS       │
└────────┬────────┘
         │
    (HTTP:8080)
         │
┌────────▼────────┐
│     NocoDB      │
│   (API REST)    │
└────────┬────────┘
         │
    (PG:5432)
         │
┌────────▼────────┐
│   PostgreSQL    │
│  (Base données) │
└─────────────────┘
```

## 📦 Volumes de données

Les données sont stockées dans des volumes Docker persistants :
- `nocodb_data` : Configuration et cache NocoDB
- `postgres_data` : Base de données PostgreSQL

Ces volumes persistent même si vous arrêtez/supprimez les conteneurs.

## 🎉 C'est tout !

Votre application est maintenant déployée et accessible. Créez votre premier utilisateur dans NocoDB et commencez à distribuer vos calendriers !
