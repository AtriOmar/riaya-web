.PHONY: infra-up infra-down infra-logs web-up web-down help

# Default target
help:
	@echo "Available commands:"
	@echo "  make infra-up     - Start the infra containers (db/redis)"
	@echo "  make infra-down   - Stop the infra containers"
	@echo "  make infra-logs   - View live logs from the infra containers"
	@echo "  make web-up    - Build and start the Next.js web application"
	@echo "  make web-down  - Stop the Next.js web application"

# Database / Infra commands
infra-up:
	docker compose -f docker-compose.infra.yml up -d

infra-down:
	docker compose -f docker-compose.infra.yml down

infra-logs:
	docker compose -f docker-compose.infra.yml logs -f

# Web App commands
web-up:
	docker compose up --build -d

web-down:
	docker compose down
