.PHONY: up up-d

up:
	docker compose -f docker/docker-compose.yml up --build

up-d:
	docker compose -f docker/docker-compose.yml up --build -d
