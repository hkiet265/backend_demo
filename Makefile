.PHONY: help build up down restart logs ps clean backup restore

# Help command
help:
	@echo "🐳 Em Tư Docker Commands"
	@echo ""
	@echo "Development:"
	@echo "  make build          - Build all containers"
	@echo "  make up             - Start all services"
	@echo "  make down           - Stop all services"
	@echo "  make restart        - Restart all services"
	@echo "  make logs           - View all logs"
	@echo "  make ps             - List running containers"
	@echo ""
	@echo "Production:"
	@echo "  make prod-build     - Build production images"
	@echo "  make prod-up        - Start production environment"
	@echo "  make prod-down      - Stop production environment"
	@echo ""
	@echo "Database:"
	@echo "  make db-connect     - Connect to database"
	@echo "  make backup         - Backup database"
	@echo "  make restore        - Restore database from backup"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean          - Remove containers and volumes"
	@echo "  make clean-all      - Remove everything including images"
	@echo "  make rebuild        - Clean and rebuild from scratch"

# Development commands
build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

logs-db:
	docker-compose logs -f postgres

ps:
	docker-compose ps

# Production commands
prod-build:
	docker-compose -f docker-compose.prod.yml build

prod-up:
	docker-compose -f docker-compose.prod.yml up -d

prod-down:
	docker-compose -f docker-compose.prod.yml down

prod-logs:
	docker-compose -f docker-compose.prod.yml logs -f

# Database commands
db-connect:
	docker-compose exec postgres psql -U postgres -d emtu_db

db-shell:
	docker-compose exec postgres bash

backup:
	docker-compose exec postgres pg_dump -U postgres emtu_db > backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "✅ Backup created: backup_$(shell date +%Y%m%d_%H%M%S).sql"

restore:
	@echo "⚠️  This will restore database from backup.sql"
	@read -p "Continue? [y/N] " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose exec -T postgres psql -U postgres emtu_db < backup.sql; \
		echo "\n✅ Database restored"; \
	fi

# Maintenance commands
clean:
	docker-compose down -v
	@echo "✅ Containers and volumes removed"

clean-all:
	docker-compose down -v --rmi all
	@echo "✅ Everything removed"

rebuild: clean-all build up
	@echo "✅ Rebuild complete"

# Individual service management
backend-restart:
	docker-compose restart backend

frontend-restart:
	docker-compose restart frontend

backend-logs:
	docker-compose logs -f backend

frontend-logs:
	docker-compose logs -f frontend

# Health checks
health:
	@echo "🏥 Checking health..."
	@curl -s http://localhost:8000/health && echo "\n✅ Backend healthy" || echo "\n❌ Backend unhealthy"
	@curl -s http://localhost:5173 > /dev/null && echo "✅ Frontend healthy" || echo "❌ Frontend unhealthy"
	@docker-compose exec postgres pg_isready && echo "✅ Database healthy" || echo "❌ Database unhealthy"

# Install dependencies
install-backend:
	docker-compose exec backend pip install -r requirements.txt

install-frontend:
	docker-compose exec frontend npm install
