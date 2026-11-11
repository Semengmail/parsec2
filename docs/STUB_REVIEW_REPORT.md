# POZ-7045 — отчёт для независимого ревью

**Исторический отчёт R1. Внешнее ревью выявило блокеры и отклонило эту итерацию.**
Исправления и актуальные проверки: [STUB_REVIEW_FIXES.md](STUB_REVIEW_FIXES.md).
Утверждения ниже описывают состояние ДО этих исправлений.

Дата: 11.11.2026. Репозиторий: `D:\job\parsec\monorepo2`, remote parsec2.
Кодовая часть подготовлена к внешнему ревью. Это НЕ утверждение о пройденном
внешнем ревью и НЕ разрешение на production. Коммитов, staging в индекс, push,
SSH и изменений сервера не было. Новая история по-прежнему содержит 0 коммитов.

Порядок дальше: независимое ревью → исправление замечаний и повторные проверки →
быстрый ручной тест Nick → отдельные команды на коммит/push и серверный этап.
Opus недоступен среди моделей этой сессии; отдельное Opus-ревью здесь не запускалось.
Этот отчёт предназначен для передачи такому ревьюверу.

## Что реализовано

- Регистрация восстановлена через прежний users.create(dto); DTO, bcrypt,
  login/logout, cookies, referral и сброс пароля сохранены.
- Убраны клиентские уведомления о закрытии, включена форма `/register`.
  Лендинг уже использует относительные `/register`; новую форму на главной
  не добавляли, работающая кнопка закрывает соответствующую подзадачу.
- Заглушка во всём `(protected)`, без меню/оплаты, с контактом @toolzar_help
  и настоящим logout. Тексты собраны в STUB_TEXTS.
- При заглушке login/register всегда переходят на dashboard, игнорируя next;
  старые публичные страницы результата оплаты тоже направляют на dashboard.
- STUB_MODE отключает регистрацию всех задач Schedule ДО старта (защита от
  гонки), а main после app.init() дополнительно останавливает Registry.
  Поэтому строка `0 cron, 0 interval, 0 timeout` корректна. Отключён также
  bootstrap-seeder тарифов, подавлены Alerting/Telegram. SMTP сброса сохранён.
- `/health` показывает stubMode. Создание платежа остаётся 503 независимо от
  STUB_MODE, текст заменён на обслуживание. Webhook/status не переписывались.
- NPM удалён из compose, приложение привязано к BIND_ADDR:3020/7101;
  DB — TimescaleDB PG17, HBA allowlist с генерацией и reload, IPv4/IPv6 reject.
- Удалён старый workflow; deploy.sh выполняет fast-forward pull, HBA reload,
  build и up --no-deps только двух сервисов приложения. Нет down/reset --hard,
  удаления volumes, удаления orphans и обновления БД при обычном деплое.
- Клиентская сборка получает только явные публичные build args из infra/.env.
  Секретный env не копируется в образ; frontend не получает общий env и при
  runtime. Добавлены Docker ignore и LF-атрибуты shell/config файлов.
- Обновлены зависимости безопасности и lock-файлы. Next 15.5.29,
  Nodemailer 10.5.0; Nest/TypeORM не переводились на новые мажоры.
  Исправлена несовместимость ajv/ESLint, клиентский ESLint согласован с Next.
  Backend lint теперь проверяет без --fix, чтобы не менять посторонний код.

## Карта файлов

Поскольку первый коммит ещё не создан, обычный git diff не показывает diff
реализации: все исходники untracked. Для проверки сравнивать с рабочей копией
`D:\job\parsec\monorepo` (её не правили), а не делать initial commit ради diff.
Изменения этой работы:

| Область | Файлы |
| --- | --- |
| Корень | .dockerignore (новый), .gitattributes (новый), README.md |
| Infra | .env.example, docker-compose.yml, scripts/deploy.sh |
| Доступ БД | db/allowed-ips.txt, db/pg_hba.conf, scripts/db-allowlist.sh — новые |
| Nginx | nginx/klaster-key-parsec-http.conf, nginx/klaster-key-parsec.conf, scripts/nginx-append-patch.py — новые |
| Backend конфигурация | .dockerignore, .env.example, .gitignore (только *.tsbuildinfo), .prettierrc (endOfLine:auto), package.json, package-lock.json |
| Backend код | src/app.module.ts, src/main.ts, src/system.controller.ts |
| Backend режим | src/common/stub-mode.ts, src/common/stub-mode.spec.ts — новые |
| Backend сервисы | modules/auth/auth.controller.ts, modules/payment/payment.controller.ts, modules/tariffs/tariffs.seeder.ts, modules/telegram/telegram.service.ts, shared/alerting/alerting.service.ts |
| Client конфигурация | .env.example, Dockerfile, package.json, package-lock.json |
| Client код | src/app/(protected)/layout.tsx, src/app/layout.tsx, src/app/login/LoginForm.tsx, src/app/register/RegisterForm.tsx |
| Client новые | src/app/payment/layout.tsx, src/widgets/stub-page/StubPage.tsx |
| Удалены | .github/workflows/deploy.yml, parsecclient/src/app/providers/ServiceClosureModal.tsx |
| Документация | infra/README.md, docs/STUB_MODE_RESTORATION.md, этот отчёт |

Побайтово подтверждено: `parsecback/src/modules/public-api` не изменён;
users-admin.controller.ts и AdminUsersPanel.tsx не изменены; корневой .gitignore
не изменён (SHA256 5C6B2BB745E93E375657572747B493625EA99321A4767FE65A491634E9210EC9).
Env, дампы, сессии и проверочные скрипты/логи в ignored tmp не попадают в список
кандидатов Git. Среди env-кандидатов только три .env.example. Индекс пуст.

## Проверки

| Проверка | Результат |
| --- | --- |
| Backend npm run build | PASS |
| Backend npm test | PASS: 2 suites, 14 tests |
| Backend lint изменённых файлов | PASS: 0 ошибок/предупреждений |
| Backend npm run lint по всему проекту | FAIL: 31 ошибка в неизменённых файлах; baseline подтверждён финальным lint |
| Client npm run build | PASS на 15.5.29, обычная локальная сборка |
| Client npm run lint | PASS, 2 прежних предупреждения TestBenchCaptcha |
| Docker backend build | PASS с окончательными зависимостями |
| Docker client build, NEXT_PUBLIC_STUB_MODE=true | PASS с окончательными зависимостями |
| Compose config с infra/.env.example | PASS |
| Bash syntax deploy/allowlist | PASS |
| Генерация HBA IPv4/IPv6 | PASS |
| HBA reload и SCRAM из app-сети | PASS, ID контейнера до/после reload совпал |
| Некорректный IP, /0 IPv4/IPv6, неверный CIDR, попытка вставки правила | PASS: отказ без замены предыдущего конфига |
| Nginx patch generator | PASS: git apply --check/apply на фикстурах LF, CRLF, без завершающего LF; исходные байты остаются префиксом |

Интеграционно проверено через реальные собранные Docker-приложения на копии БД:

1. Health stubMode:true; DTO отклоняет неверный email/короткий новый пароль.
2. Новая регистрация, повторный email → 400, вход, HttpOnly cookie с прежним
   доменом, /auth/me, неверный пароль → 401, logout очищает cookie, без cookie → 401.
3. Регистрация с referralCode; наличие реферальной записи подтверждено SQL.
4. /payment/create с действующей сессией → 503 с текстом обслуживания.
5. Сброс: генерируется письмо нужному получателю, ссылка содержит рабочий токен,
   reset-password принимает его, старый пароль перестаёт подходить, новый работает.
   Для этого использован только новый тестовый пользователь; SMTP перехвачен локально.
6. Старая тестовая учётка Nick из дампа вошла с прежним паролем; /auth/me,
   dashboard-заглушка и генерация письма сброса работают. Её пароль и баланс
   не менялись (вход штатно обновляет authCount/lastLoginAt).
7. Ровно одно реальное письмо отправлено на разрешённый адрес Nick через живой
   SMTP: accepted=true, rejected=0. Доставка в ящик ещё требует подтверждения Nick.
8. Все 10 защищённых путей: /dashboard, /frequency, /live-google, /live-yandex,
   /manage, /partner-billing, /referral, /webmaster, /wordstat, /xml-yandex —
   без cookie 307 /login, с cookie 200 и заглушка без видимого UI пополнения.
9. /payment/payment-success и /payment/payment-error при stub=true → 307 dashboard.
   Лендинг, register/login/forgot-password отвечают 200; надписей закрытия нет.

Браузерная UI-автоматизация недоступна (нет подключённых браузеров). Рендер
формы после hydration, клики «регистрация → автологин → заглушка» и визуальный
вид в браузере не выдаются за проверенные: это отдельный пункт ручного теста.
HTTP-сценарии и сборки выше проверены; Next useSearchParams/Suspense отдаёт
часть форм после клиентского рендера, поэтому один curl этого не подтверждает.

Финальный backend наблюдался 11:59:03–12:02:59 по времени Nick (более 3 минут).
Есть строка STUB_MODE; запусков cron/interval, seeder и обращений воркеров к
провайдерам в логах нет. Обычные HTTP-запросы тестов присутствуют.

## Дамп и СУБД: отличие от исходного промпта

Исходник: `D:\job\parsec\db\parsec.dump`, 191099174 байта. Восстановлен целиком
в отдельный контейнер, с --no-owner --exit-on-error и pre_restore/post_restore,
без параллельного restore. Код выхода 0.

- TimescaleDB исходной копии: 2.18.0.
- Пользователей до создания тестовых записей: 153.
- Public-таблиц: 33; ещё 20 TABLE DATA в дампе — каталоги TimescaleDB.
- timescaledb_information.hypertables, каталог hypertable и каталог chunk пусты;
  сжатых чанков нет. Исходное утверждение о 53 таблицах приложения и гипертаблицах
  не подтвердилось. Не «исправлять» данные под описание промпта.
- pg_extension_update_paths подтвердил прямой 2.18.0--2.31.0; ALTER EXTENSION
  выполнен успешно. Итог: PG17.11, TimescaleDB 2.31.0, 153 старых пользователя
  до интеграционных вставок. PG18 не использовался.
- Контрольные бэкапы: ignored tmp/before-upgrade.dump (191145505 байт) и
  tmp/after-upgrade.dump (191145127 байт), pg_restore -l читается.
  В production пока не копировались. Локальные SQL-тесты добавили только тестовые
  записи в отдельную копию дампа; существующий стейдж не менялся.

Процедуры сверены с официальными
[backup/restore](https://www.tigerdata.com/docs/deploy/self-hosted/backup-and-restore/logical-backup),
[upgrade](https://www.tigerdata.com/docs/deploy/self-hosted/upgrades/minor-upgrade) и
[release 2.31.0](https://github.com/timescale/timescaledb/releases/tag/2.31.0).

## Унаследованные замечания, которые нельзя скрывать

Полный backend lint: 31 ошибка в 15 неизменённых файлах. После обновления
инструментов правило no-unnecessary-type-assertion выявляет больше мест, чем
первоначальная версия (сначала было 6 ошибок). С финальной конфигурацией
проверены тексты всех этих файлов из старого monorepo: те же 31 ошибка,
побайтовое совпадение с текущими исходниками. Автоформатирования не было.

- common/filters/all-exceptions.filter.ts: no-unsafe-enum-comparison, строка 30.
- modules/mail/mail.controller.ts: require-await, строка 10.
- modules/mail/mail.service.spec.ts: require-await, строка 64.
- modules/task-stats/task-throughput.service.ts: no-unnecessary-type-assertion, строка 125.
- modules/users/users-admin.controller.ts: prettier, строка 42.
- modules/users/users.service.ts: prettier, строка 261.

Оставшиеся 25 диагностик того же правила no-unnecessary-type-assertion:
modules/frequency/frequency.service.ts, modules/public-api/googlelive.service.ts,
modules/public-api/utils/uule.ts, modules/public-api/xml/yandex-xml.ts,
modules/services/public-info.controller.ts, modules/services/public-info.service.ts,
modules/services/services.controller.ts, modules/test-bench/test-bench-engine-config.service.ts,
modules/test-bench/test-bench.service.ts. Полная машинная детализация:
ignored tmp/backend-lint-final.json. В исходниках этих файлов изменений нет.

Последние два относятся к прежним административным операциям закрытия, которые
промпт запрещает трогать. Ревьювер должен явно учесть baseline; полный lint
не объявлен зелёным. В изменённых файлах новых lint-ошибок нет.

Аудит production: frontend — 0; backend — 3 moderate (цепочка TypeORM → glob →
minimatch), 0 high/critical. Полный backend с dev: 28 замечаний (2 low, 26 moderate),
0 high/critical. Полный frontend: 6 moderate в инструментах lint, production чист.
Не применялся audit fix --force: обновление мажоров ORM/Nest/инструментов ради
оставшихся moderate выходит за совместимые исправления этой задачи.

## Сервер: только подготовленные материалы

Боевые сервисы не трогались; соединений по SSH не было. Для nginx подготовлены
HTTP-фрагмент, полный фрагмент и генератор точного append-патча от актуальной
резервной копии. Настоящий patch для репозитория klaster-key нужно получить
позже из его текущего конфига, передать Семёну и добиться коммита: иначе его
git reset --hard удалит добавление.

Выбран bind на gateway klaster-key_default, ожидается 172.18.0.1, но проверка на
реальном сервере ещё впереди. Фолбэк «публичный bind + только ufw» не применяется:
ufw не гарантирует фильтрацию Docker-публикаций. Никаких новых правил firewall
и изменений чужого compose не делалось.

Внешний HBA reject не проверен с третьего реального IP: Docker Desktop при
обращении через опубликованный локальный порт маскирует источник адресом
шлюза, попадающим под samenet. Локальный тест этого пути не является доказательством
внешней фильтрации. На сервере проверить два разрешённых IP и один запрещённый,
а также доступ nginx к приложению и недоступность 3020/7101 из интернета.

До production также нужны: команда Nick, почта Let's Encrypt, добавление
read-only deploy key в GitHub, проверки ресурсов/портов и «до/после» чужих
контейнеров и сайтов. Применять только последовательность infra/README.md.

## Что проверить независимому ревьюверу

1. Раннее отключение Schedule действительно не допускает тика при bootstrap;
   отключение seeder/Alerting не отключило SMTP восстановления.
2. Согласованность обоих env-флагов и build args; заглушка на вложенных путях,
   редиректы next/payment, корректный logout.
3. Неприкосновенность public-api и административных операций закрытия.
4. HBA: local trust, allowlist SCRAM, samenet только частной сети приложения,
   reject IPv4/IPv6; атомарная замена видна благодаря mount каталога.
5. Безопасность deploy.sh: отсутствие рестартов БД и чужих сервисов; корректность
   будущей процедуры обновления/отката БД и nginx patch.
6. Baseline lint и оставшиеся moderate зависимости, границы ручной проверки.

Памятка следующему агенту: [STUB_MODE_RESTORATION.md](STUB_MODE_RESTORATION.md).
