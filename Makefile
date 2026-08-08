.PHONY: db-up db-down db-logs web-up web-down help

# Default target
help:
	@echo "Available commands:"
	@echo "  make db-up     - Start the database container"
	@echo "  make db-down   - Stop the database container"
	@echo "  make db-logs   - View live logs from the database container"
	@echo "  make web-up    - Build and start the Next.js web application"
	@echo "  make web-down  - Stop the Next.js web application"

# Database commands
db-up:
	docker compose -f docker-compose.db.yml up -d

db-down:
	docker compose -f docker-compose.db.yml down

db-logs:
	docker compose -f docker-compose.db.yml logs -f postgres

# Web App commands
web-up:
	docker compose up --build -d

web-down:
	docker compose down
