.PHONY: help start stop restart logs status clean backup restore

# Variables
COMPOSE=docker-compose
PROJECT_NAME=calendriers_pompiers

help: ## Affiche cette aide
	@echo "Commandes disponibles pour le projet Distribution Calendriers Pompiers:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

start: ## Démarre tous les services
	@echo "🚀 Démarrage des services..."
	$(COMPOSE) up -d
	@echo "✅ Services démarrés ! Accédez à l'application sur http://localhost"

stop: ## Arrête tous les services
	@echo "🛑 Arrêt des services..."
	$(COMPOSE) down
	@echo "✅ Services arrêtés"

restart: ## Redémarre tous les services
	@echo "🔄 Redémarrage des services..."
	$(COMPOSE) restart
	@echo "✅ Services redémarrés"

logs: ## Affiche les logs en temps réel
	$(COMPOSE) logs -f

logs-webapp: ## Affiche les logs de l'application web
	$(COMPOSE) logs -f webapp

logs-nocodb: ## Affiche les logs de NocoDB
	$(COMPOSE) logs -f nocodb

logs-postgres: ## Affiche les logs de PostgreSQL
	$(COMPOSE) logs -f postgres

status: ## Affiche le statut des services
	@echo "📊 Statut des services:"
	@$(COMPOSE) ps
	@echo ""
	@echo "💾 Utilisation des ressources:"
	@docker stats --no-stream $(PROJECT_NAME)_webapp $(PROJECT_NAME)_nocodb $(PROJECT_NAME)_postgres 2>/dev/null || true

build: ## Reconstruit les images (si nécessaire)
	@echo "🔨 Reconstruction des images..."
	$(COMPOSE) build
	@echo "✅ Images reconstruites"

pull: ## Télécharge les dernières versions des images
	@echo "⬇️  Téléchargement des dernières images..."
	$(COMPOSE) pull
	@echo "✅ Images à jour"

update: pull restart ## Met à jour et redémarre les services

clean: ## Nettoie les conteneurs et images inutilisés
	@echo "🧹 Nettoyage..."
	docker system prune -f
	@echo "✅ Nettoyage terminé"

clean-all: ## ⚠️  DANGER: Supprime TOUT (conteneurs, volumes, données)
	@echo "⚠️  ATTENTION: Cette commande va supprimer TOUTES les données !"
	@read -p "Êtes-vous sûr ? Tapez 'yes' pour continuer: " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		echo "🗑️  Suppression de tout..."; \
		$(COMPOSE) down -v; \
		docker volume rm $(PROJECT_NAME)_nocodb_data $(PROJECT_NAME)_postgres_data 2>/dev/null || true; \
		echo "✅ Tout a été supprimé"; \
	else \
		echo "❌ Annulé"; \
	fi

backup: ## Sauvegarde la base de données
	@mkdir -p backups
	@echo "💾 Sauvegarde de la base de données..."
	@docker-compose exec -T postgres pg_dump -U nocodb nocodb > backups/backup-$$(date +%Y%m%d-%H%M%S).sql
	@echo "✅ Sauvegarde créée dans backups/"

restore: ## Restaure la dernière sauvegarde (spécifiez FILE=backup.sql)
	@if [ -z "$(FILE)" ]; then \
		echo "❌ Erreur: Spécifiez le fichier avec FILE=backup.sql"; \
		echo "Exemple: make restore FILE=backups/backup-20231215.sql"; \
		exit 1; \
	fi
	@echo "📥 Restauration depuis $(FILE)..."
	@docker-compose exec -T postgres psql -U nocodb nocodb < $(FILE)
	@echo "✅ Restauration terminée"

shell-webapp: ## Ouvre un shell dans le conteneur webapp
	$(COMPOSE) exec webapp sh

shell-nocodb: ## Ouvre un shell dans le conteneur NocoDB
	$(COMPOSE) exec nocodb sh

shell-postgres: ## Ouvre un shell PostgreSQL
	$(COMPOSE) exec postgres psql -U nocodb nocodb

reset-db: ## ⚠️  Réinitialise complètement la base de données
	@echo "⚠️  ATTENTION: Cela va supprimer toutes les données !"
	@read -p "Êtes-vous sûr ? Tapez 'yes' pour continuer: " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		echo "🗑️  Réinitialisation de la base..."; \
		$(COMPOSE) down; \
		docker volume rm $(PROJECT_NAME)_postgres_data 2>/dev/null || true; \
		$(COMPOSE) up -d; \
		echo "✅ Base de données réinitialisée"; \
	else \
		echo "❌ Annulé"; \
	fi

install: ## Installation initiale complète
	@echo "📦 Installation du projet..."
	@if [ ! -f .env ]; then \
		echo "📝 Création du fichier .env..."; \
		cp .env.example .env; \
		echo "⚠️  N'oubliez pas de modifier .env avec vos paramètres !"; \
	fi
	@echo "🐳 Démarrage des services..."
	$(COMPOSE) up -d
	@echo ""
	@echo "✅ Installation terminée !"
	@echo ""
	@echo "📋 Prochaines étapes:"
	@echo "  1. Modifiez le fichier .env avec vos paramètres"
	@echo "  2. Accédez à NocoDB sur http://localhost:8080"
	@echo "  3. Créez un compte administrateur"
	@echo "  4. Créez les tables nécessaires (voir DEPLOYMENT.md)"
	@echo "  5. Générez un token API et mettez-le dans nocodb-config.js"
	@echo "  6. Accédez à l'application sur http://localhost"
	@echo ""

dev: ## Mode développement avec logs
	$(COMPOSE) up

test-connection: ## Teste la connexion aux services
	@echo "🔍 Test de connexion..."
	@echo -n "  Webapp (port 80): "
	@curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null && echo "✅" || echo "❌"
	@echo -n "  NocoDB (port 8080): "
	@curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null && echo "✅" || echo "❌"

info: ## Affiche les informations du projet
	@echo "ℹ️  Informations du projet:"
	@echo "  Nom: Distribution Calendriers Pompiers"
	@echo "  Services: webapp, nocodb, postgres"
	@echo "  Webapp: http://localhost"
	@echo "  NocoDB: http://localhost:8080"
	@echo ""
	@echo "📦 Volumes:"
	@docker volume ls | grep $(PROJECT_NAME) || echo "  Aucun volume"
	@echo ""
	@echo "🌐 Réseau:"
	@docker network ls | grep $(PROJECT_NAME) || echo "  Aucun réseau"
