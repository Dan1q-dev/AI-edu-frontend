# AI Edu frontend

Админский редактор лекций (`src/LessonEditorPage.tsx`, `src/lecture/`) использует единый Tiptap-документ:
общее выделение и история отмены, белый лист и постоянная панель «Главная / Вставка» с обычными
инструментами форматирования. Таблицы, изображения, врезки, разделители, LaTeX и видео по HTTPS-ссылке
(YouTube, RuTube, MP4). Формулы редактируются нажатием; подпись, альтернативный текст, ширина
и замена изображения доступны при его выборе. Оглавление открывается по кнопке; ручки перетаскивания
включаются через «Дополнительные инструменты → Упорядочить элементы». Дополнительно поддерживается `/`.
Материалы для скачивания свёрнуты под документом, черновик можно сохранить через Ctrl+S / Cmd+S.
AI в этом редакторе не используется.

Формат API не изменён: текстовые фрагменты сохраняются в `TEXT`, изображения — в `IMAGE` с отдельными
ссылками на медиа для существующей проверки доступа. Старые лекции открываются без миграции.
Черновик сохраняется автоматически; студентам изменения доступны после публикации.

Браузерные проверки редактора используют подменённый API и не обращаются к рабочему backend:
`npx playwright install chromium`, затем `npm run test:editor`. Они запускают отдельный Vite на порту 5178.

`lecture_workshop@1.0.0` поддерживает двухпанельную мастерскую на `/items/:id`: параметры лекции,
AI-чат, улучшение запроса, генерацию, редактор Tiptap и сдачу с самооценкой.
[Описание интерфейса, API и ограничений восстановления](docs/lecture-workshop.md).

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

Production frontend собирается и раздаётся Node-сервером на порту 3000 контейнера, доступном на хосте как `127.0.0.1:8080`. Внешний Nginx обслуживает `https://aiedu.com.kz`: `/api/` направляет на backend `127.0.0.1:4000`, остальные запросы — на frontend `127.0.0.1:8080`. Сохраните существующий маршрут Django static files. Пример маршрутов и значения backend `.env` приведены в README backend.

Браузер использует относительный адрес `/api/v1/`, поэтому домен API в frontend `.env` для production задавать не нужно. `API_PROXY_TARGET=http://backend:8000` в `.env.example` предназначен для Docker-разработки; standalone production Compose передаёт API внешнему Nginx и не загружает этот `.env` в Node-процесс.

## Локальная разработка без Docker

```bash
npm ci
npm run dev
```

Vite использует `API_PROXY_TARGET` из `.env`: в Docker — `http://backend:8000`, вне Docker — `http://localhost:8000`. Без этой переменной Vite обращается к `https://aiedu.com.kz`.

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
