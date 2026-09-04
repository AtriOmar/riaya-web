.PHONY: dev/infra-up dev/infra-down dev/infra-logs prod/infra-up prod/infra-down prod/infra-logs prod/migrate web-up web-down help

# Default target
help:
	@echo "Available commands:"
	@echo "  make dev/infra-up     - Start the infra containers locally (db/redis) with ports"
	@echo "  make dev/infra-down   - Stop the local infra containers"
	@echo "  make dev/infra-logs   - View live logs from the local infra containers"
	@echo "  make prod/infra-up    - Start the infra containers for production (no ports)"
	@echo "  make prod/infra-down  - Stop the production infra containers"
	@echo "  make prod/infra-logs  - View live logs from the production infra containers"
	@echo "  make prod/migrate     - Run database migrations in a temporary Docker container"
	@echo "  make web-up           - Build and start the Next.js web application"
	@echo "  make web-down         - Stop the Next.js web application"

# Local / Dev Infra commands
dev/infra-up:
	docker compose -f docker-compose.infra.yml up -d

dev/infra-down:
	docker compose -f docker-compose.infra.yml down

dev/infra-logs:
	docker compose -f docker-compose.infra.yml logs -f

# Prod Infra commands
prod/infra-up:
	docker compose -f docker-compose.infra.prod.yml up -d

prod/infra-down:
	docker compose -f docker-compose.infra.prod.yml down

prod/infra-logs:
	docker compose -f docker-compose.infra.prod.yml logs -f

prod/migrate:
	docker run --rm -v $$(pwd):/app -w /app --env-file .env --network riaya_network node:22-alpine sh -c "npm install -g drizzle-kit pg dotenv tsx drizzle-orm && NODE_PATH=\$$(npm root -g) drizzle-kit migrate"

# Web App commands
web-up:
	docker compose up --build -d

web-down:
	docker compose down
