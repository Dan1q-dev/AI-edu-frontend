# AI Edu frontend

React + TypeScript интерфейс для платформы. Репозиторий содержит отдельный Compose-проект только для frontend-сервиса.

## Docker Compose

Сначала запустите backend из его репозитория. Он создаёт общую Docker-сеть `aiedu-platform` и сервис `backend`. Затем:

1. Скопируйте `.env.example` в `.env`. По умолчанию frontend обращается к backend по внутреннему адресу `http://backend:8000`.
2. Запустите из корня этого репозитория:

```bash
docker compose up --build -d
```

Приложение откроется на `http://localhost:5173`. Этот Compose содержит только сервис `frontend`; PostgreSQL, Redis, MinIO и Django запускаются из репозитория backend. Во frontend `.env` нет паролей или ключей.

## Production

После запуска backend с его `docker-compose.prod.yml` выполните:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Production frontend собирается и раздаётся Nginx на порту 80. Nginx обращается к backend в общей сети и использует общий volume `aiedu-static`. Перед публичным запуском настройте внешний TLS reverse proxy и HTTPS-origin в backend `.env`.

## Локальная разработка без Docker

```bash
npm ci
npm run dev
```

Vite использует `API_PROXY_TARGET` из `.env`; значение по умолчанию — `http://backend:8000`. Для запуска Vite вне Docker укажите `API_PROXY_TARGET=http://localhost:8000`.

Проверки: `npm run test`, `npm run build`.
