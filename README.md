# AI Edu frontend

Практические работы используют Practice Engine: каталог карточек из `GET /api/v1/practice-types/`, динамический редактор конфигурации и student runtime. Реализован `checklist_practice@1.0.0`. Компоненты и контракт находятся в `src/practice/`; регистрация нового типа — в `registry.ts`. Backend должен зарегистрировать manifest с тем же кодом и версией. Неизвестные типы отображаются недоступными.

Редактор сохраняет черновик отдельно от публикации. Начало student attempt закрепляет версию задания; frontend отправляет только ID попытки и состояния критериев. Значение Ψ, источник и прогресс возвращает сервер. Архитектура, API и миграции описаны в README backend, разделе Practice Engine. Проверки: `npm test` и `npm run build`.

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
### Student learning links

The student flow uses `/items/:id`. Existing `/lessons/:id` bookmarks resolve the
explicit `learning_item_short_id` relation returned by the lesson API and redirect
with history replacement. Migrated lectures keep their original public ID, but
the relation is used rather than assuming the IDs always match. If a legacy
lesson has no LearningItem relation, the page explains that it is unavailable
and offers the catalog; it does not run a second learning/progress flow.

`GET /api/v1/me/learning/` supplies the dashboard in one request. Course progress
uses the same server derivation for completion and resume. Scroll percentages
are preserved; exact scroll restoration is intentionally left for a later step.
