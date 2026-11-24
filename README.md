# Парсек

Монорепозиторий: `parsecback` (NestJS), `parsecclient` (Next.js), `infra` (Compose).
Новый remote: `git@github.com:Semengmail/parsec2.git`. Автоматического деплоя нет.
Коммиты, push и работа на production — только по команде Nick.
Актуальный [отчёт повторного ревью](docs/STUB_REVIEW_R3.md) и
[памятка снятия заглушки](docs/STUB_MODE_RESTORATION.md).
Первое production-развёртывание: [результаты, доступ к БД и nginx-патч](docs/DEPLOYMENT_REPORT.md).

## Режим заглушки

`STUB_MODE=true` отключает регистрацию фоновых задач Nest Schedule, останавливает
оставшиеся задачи после `app.init()`, отключает seeder тарифов и все оповещения
Alerting/Telegram. SMTP сброса пароля остаётся доступным. `/health` возвращает
`{"stubMode":true}`. По умолчанию флаг выключен.

`NEXT_PUBLIC_STUB_MODE=true` заменяет все страницы `(protected)` заглушкой после
проверки наличия cookie. Без cookie — `/login`. В заглушке только сообщение,
контакт поддержки и выход. Флаг клиента встраивается при build: необходима пересборка.
Регистрация и вход используют прежнюю таблицу users и прежнее хеширование паролей.
Создание платежа возвращает 503 независимо от флага. Webhook в STUB_MODE
подтверждается 200 без обработки. Создание частотных задач при STUB_MODE
возвращает штатную JSON-ошибку code 52 до списания баланса; остальные публичные
маршруты сохранены. Опасные общие /users/:id удалены, свои данные доступны
через /users/me. Регистрация и сброс ограничены по IP/учётке, вход — только по IP.
Служебные economy/statistics/
test-bench маршруты и генерация referral-кодов требуют admin-сессию.
Заявки /mail/import-request ограничены по IP и общим бюджетом ящика.
Кнопки регистрации на лендинге ведут на `/register` того же домена; новую форму
на главной не добавляем.

## Лендинг на toolzar.ru/parsec

Лендинг перенесён на основной сайт (код в клиенте Toolzar). При заданном
`PARSEC_LANDING_URL` (production: `https://toolzar.ru/parsec`) главная `/`
отвечает 301 на этот адрес, строка запроса (`?ref`, `utm_*`) сохраняется;
реферальную куку `referralCode` на `.toolzar.ru` ставит уже новый лендинг.
Остальные адреса (`/login`, `/register`, кабинет, документы) не меняются.
Значение встраивается при build клиента: после изменения пересобрать
`parsecclient`. Пусто — редиректа нет.

## Локальный запуск

Node.js 22, npm, Docker Compose; для allowlist-скрипта Bash и Python 3.
Не пересоздавать существующий `parsec_db` без разрешения владельца стейджа.

1. Скопировать `.env.example` бэкенда в `.env.development.local`, клиента — в `.env`.
   Настроить секреты локально; установить оба stub-флага в true для проверки заглушки.
2. Бэкенд: `npm ci`, затем `npm run start:dev`; клиент: `npm ci`, затем `npm run dev`.
3. В hosts: `127.0.0.1 parsec.toolzar.localhost api.parsec.toolzar.localhost`.
   Клиент: `http://parsec.toolzar.localhost:3020`, API: порт 7101.
   Cookie domain `.toolzar.localhost`, secure=false, CORS с origin клиента.
4. БД и Redis берутся из локальных env. Для нового окружения сначала заполнить
   `infra/.env` из примера, установить `BIND_ADDR=127.0.0.1`, сгенерировать HBA:
   `bash infra/scripts/db-allowlist.sh --generate-only`, затем из infra:
   `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d db redis`.
   Local override публикует Redis только для npm-стейджа; в production Redis
   наружу не опубликован. Не применять к уже занятому стейджу.

## Проверки

В `parsecback`: `npm run build`, `npm run lint`, `npm test`.
В `parsecclient`: `npm run build`, `npm run lint`.
В обоих проектах lint включает ESLint с нулевым допуском предупреждений и
проверку TypeScript. Есть `npm run lint:fix` и `npm run typecheck`.
Lint работает без автоматического исправления исходников, чтобы ревью
не меняло публичное API и другие неизменённые файлы.
Для редактора открыть `parsec.code-workspace`; [настройки и результаты](docs/LINT_AND_VSCODE.md).

## Production и ручной Deploy

Инструкции восстановления БД, IP allowlist, безопасного деплоя и добавления
доменов в nginx klaster-key — в [infra/README.md](infra/README.md).
Секреты хранятся только в `/opt/parsec/infra/.env` (chmod 600), в Git — примеры.
TYPEORM_SYNC=true (решение Nick от 12.11.2026): схема при старте бэкенда приводится
к entities. Перед выкладкой изменений entities снимать бэкап — см. infra/README.md.
Куки `psk.sid` на `.toolzar.ru`.

После первого развёртывания обновление приложения:

```bash
cd /opt/parsec
git pull --ff-only
bash infra/scripts/deploy.sh
```

Скрипт повторно выполняет безопасный fast-forward pull, собирает и обновляет
только два контейнера приложения с `--no-deps`; БД и Redis обновляются отдельно.
Не выполняет down, не удаляет volumes и не обращается к compose других проектов.
