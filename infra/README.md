# Парсек: ручной деплой

Production — только после команды Nick, внешнего ревью и его ручного теста.
Проект `/opt/parsec`, root. Никаких команд остановки/пересоздания чужих сервисов.
Не менять compose, env, cron или firewall klaster-key. NPM здесь отсутствует.

## Env и сети

Скопировать `.env.example` в `.env`, заполнить секреты, `chmod 600 .env`.
Сохранить исходный API_KEY_ENC_SECRET (64 hex-символа) для расшифровки старых ключей.
JWT_SECRET и RESET_PASSWORD_SECRET обязательны; SESSION_SECRET не заменяет JWT_SECRET.
SMTP: SUPPORT_EMAIL_HOST/USER/PASSWORD и SUPPORT_EMAIL. STUB_MODE=true,
NEXT_PUBLIC_STUB_MODE=true, TYPEORM_SYNC=false. Внешние интеграции в примере пустые.
Публичное API оставлено прежним и может обращаться к провайдерам по явным запросам.

На production проверить `docker network inspect klaster-key_default`: ожидаемый
gateway `172.18.0.1`. Только после проверки установить `BIND_ADDR=172.18.0.1`.
Клиент и API публикуются на этом адресе, 3020 и 7101. Не публиковать их на
0.0.0.0. Локально `BIND_ADDR=127.0.0.1`. Проверить фактическую доступность из nginx
и недоступность из интернета. При неработающем bind остановиться и пересмотреть
сетевую схему: одно ufw allow/deny не ограничивает опубликованные Docker-порты.

БД публикуется на `DB_BIND=0.0.0.0`, 5433; авторизация ограничена HBA.
Redis в production доступен только в appnet, порт хоста не публикуется.
Для нового локального npm-стейджа использовать дополнительный
`-f docker-compose.local.yml`; он публикует 127.0.0.1:${LOCAL_REDIS_PORT:-6379}.
Существующий стейдж без разрешения не пересоздавать.
NEXT_PUBLIC_* передаются из infra/.env в build через явный список build args.
Общий env с секретами в сборочный контекст и образ не попадает.

## База: доступ по IP

Список: `db/allowed-ips.txt`, IP/CIDR по одному на строку, комментарии `#` допустимы.
Установить Python 3 и Bash на хосте. Перед первым запуском:

```bash
bash scripts/db-allowlist.sh --generate-only
docker compose config --quiet
docker compose up -d db redis
```

Для нового IP добавить строку в файл и выполнить из infra:

```bash
bash scripts/db-allowlist.sh
```

Скрипт валидирует адреса, запрещает /0, атомарно заменяет HBA в примонтированном
каталоге, проверяет pg_hba_file_rules и вызывает pg_reload_conf(). Контейнер не
пересоздаётся, соединения не обрываются. `--generate-only` только создаёт файл.
Сохранены local trust-правила; внешние разрешённые IP используют scram-sha-256,
контейнеры — samenet scram-sha-256, остальные IPv4/IPv6 — reject до пароля.
`samenet` включает непосредственно подключённые к БД подсети: не подключать БД
к общим/чужим сетям. Ufw не является защитой опубликованного Docker-порта.
Проверить доступ с обоих разрешённых IP и отказ с третьего. Уже открытые сессии
не отзываются изменением списка.

## Первичное восстановление и обновление TimescaleDB

Приложение пока не запускать. Только свежий том Парсека, не рабочая БД стейджа.
ДО первого запуска установить бюджет: DB_MEMORY_LIMIT=1g, DB_CPU_LIMIT=1.0,
TS_TUNE_MEMORY=512MB, TS_TUNE_NUM_CPUS=1, TS_TUNE_MAX_CONNS=60. Это консервативные
значения для заглушки, окончательно сверить с доступными ресурсами общего сервера.
Проверено на новом томе: shared_buffers=128MB, effective_cache_size=384MB,
work_mem=3413kB, max_connections=60; Docker ограничивает RAM 1 GiB и CPU одним ядром.
timescaledb-tune записывает конфиг только при первой инициализации. На существующем
томе env не перетюнит старый конфиг: проверить SHOW shared_buffers/work_mem/max_connections
и согласовать изменение postgresql.conf отдельно; не уменьшать лимит контейнера
вслепую под уже записанные большие настройки.
В `.env` временно TIMESCALE_IMAGE=timescale/timescaledb:2.18.0-pg17.
Дамп: `parsec.dump` от 19.08.2026, не старый parseback_prod.dump.
Загрузить его в `/opt/parsec/backups/parsec-2026-08-19.dump`.
Первый запуск db создаёт DB_NAME и расширение через образ. Команды ниже
используют POSTGRES_USER/DB из контейнера, без пароля в аргументах:

```bash
docker compose up -d db
docker compose exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker cp /opt/parsec/backups/parsec-2026-08-19.dump parsec_db:/tmp/source.dump
docker compose exec -T db sh -ec 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS timescaledb; SELECT timescaledb_pre_restore();"'
docker compose exec -T db sh -ec 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --exit-on-error /tmp/source.dump'
docker compose exec -T db sh -ec 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT timescaledb_post_restore();"'
```

Дождаться завершения КАЖДОЙ команды и проверить код выхода. При ошибке restore
не запускать приложение и не продолжать обновление. Не использовать `-j`.
Если DB_NAME уже содержит данные, не выполнять restore поверх неё и не удалять
её автоматически: отдельно согласовать, сохранить бэкап и выбрать свежую БД.

Проверить extversion, count users, таблицы и timescaledb_information.hypertables.
В локальном прогоне этого дампа: 153 users, 33 public-таблицы и 20 TABLE DATA
каталогов Timescale; гипертаблиц/чанков нет. Не выдавать 53 за число public-таблиц.
Перед обновлением снять бэкап В КОНТЕЙНЕР, затем скопировать на хост (не передавать
бинарный дамп через PowerShell pipeline):

```bash
docker compose exec -T db sh -ec 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/before-upgrade.dump'
docker cp parsec_db:/tmp/before-upgrade.dump /opt/parsec/backups/before-upgrade.dump
```

Сначала убедиться, что файл существует и читается `pg_restore -l`, затем сменить
TIMESCALE_IMAGE на точный `timescale/timescaledb:2.31.0-pg17`, только после этого:

```bash
docker compose up -d --no-deps db
docker compose exec -T db sh -ec 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER EXTENSION timescaledb UPDATE TO '\''2.31.0'\'';"'
docker compose exec -T db sh -ec 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/after-upgrade.dump'
docker cp parsec_db:/tmp/after-upgrade.dump /opt/parsec/backups/after-upgrade.dump
```

Прямой путь 2.18.0→2.31.0 проверен через pg_extension_update_paths и выполнен
локально. Получен PostgreSQL 17.11, TimescaleDB 2.31.0. Мажор PG не меняется.
Повторно проверить данные и читаемость дампа, затем приложение. Откат расширения
путём подстановки старого образа поверх обновлённого тома запрещён: восстановить
before-upgrade.dump в отдельный новый том с 2.18.0, сохранив исходный том.

Источники: [backup/restore](https://www.tigerdata.com/docs/deploy/self-hosted/backup-and-restore/logical-backup),
[upgrade](https://www.tigerdata.com/docs/deploy/self-hosted/upgrades/minor-upgrade),
[release 2.31.0](https://github.com/timescale/timescaledb/releases/tag/2.31.0).

## Nginx klaster-key: только добавление

Перед выходом на сервер нужны команда Nick, почта Let's Encrypt, deploy key
GitHub read-only и передача патча Семёну. Не использовать `git reset --hard`.
Снять «до»: docker ps с CreatedAt, df -h, free -h, ufw status, ответы
klaster-key.ru и key-turbo.ru. Не выводить чужие env/секреты.

1. Скопировать `/opt/klaster-key/deploy/nginx-tls.conf` в
   `/opt/parsec/backups/nginx-tls.conf.before-parsec`.
2. Проверить отсутствие server_name обоих доменов и совпадение gateway.
   Сначала `printf '\n\n' >> /opt/klaster-key/deploy/nginx-tls.conf`, затем
   `cat /opt/parsec/infra/nginx/klaster-key-parsec-http.conf >> /opt/klaster-key/deploy/nginx-tls.conf`.
   Так сохраняются inode и все исходные байты, а разделитель совпадает с патчем.
   `docker compose -f /opt/klaster-key/docker-compose.yml
   exec -T nginx nginx -t`, только при успехе аналогично `nginx -s reload`.
3. Проверить HTTP challenge по обоим доменам и выпустить один сертификат:

```bash
cd /opt/klaster-key
docker compose --profile certbot run --rm --no-deps certbot certonly --webroot -w /var/www/certbot --cert-name parsec.toolzar.ru -d parsec.toolzar.ru -d api.parsec.toolzar.ru --email OWNER_EMAIL --agree-tos --non-interactive
```

4. После выпуска выполнить
   `cat /opt/parsec/infra/nginx/klaster-key-parsec-https.conf >> /opt/klaster-key/deploy/nginx-tls.conf`.
   Ничего вручную не вырезать, HTTP-блоки не повторять. Снова nginx -t и reload
   без рестарта. Полный klaster-key-parsec.conf равен HTTP + HTTPS побайтово;
   генератор откажет, если они разойдутся. Патч соответствует фактическим append.
5. Проверить `certbot renew --cert-name parsec.toolzar.ru --dry-run --no-random-sleep-on-renew`
   через тот же compose, существующий cron и оба чужих сайта.
   Не изменять cron. Проверить прежние CREATED/ID чужих контейнеров.
6. Сгенерировать полноценный патч от резервной копии, передать Nick для Семёна:

```bash
python3 /opt/parsec/infra/scripts/nginx-append-patch.py /opt/parsec/backups/nginx-tls.conf.before-parsec > /opt/parsec/backups/klaster-key-parsec.patch
```

Патч нельзя окончательно подготовить без актуального исходного nginx-конфига;
генератор не изменяет его. Семён должен закоммитить патч в klaster-key, иначе
его git reset --hard затрёт блок. Это обязательный пункт до обычных деплоев.
Если nginx -t не проходит, не делать reload; восстанавливать содержимое из
резервной копии в тот же inode, повторно nginx -t, согласовав действия.

На первом развёртывании обнаружен старый bind mount: nginx читал удалённый inode,
а путь на хосте уже указывал на другой файл. `docker cp` в таком случае возвращал
файл по пути хоста; фактические байты проверялись через `docker exec … cat`.
Одного reload после изменения хостового файла недостаточно. См. выполненное
исправление без рестарта в [отчёте развёртывания](../docs/DEPLOYMENT_REPORT.md).
Перед следующей правкой сверять фактическое содержимое в контейнере и на хосте;
не повторять append вслепую и не пересоздавать общий nginx.

## Приложение и обновления

Первый запуск: из `/opt/parsec/infra` выполнить `docker compose build`, затем
`docker compose up -d`, проверить docker compose ps. БД к этому моменту уже
восстановлена и проверена. /health — stubMode:true, регистрация/вход/сброс,
любой маршрут кабинета — заглушка, payment/create — 503. Наблюдать логи ≥2 минут.
Затем free -h, df -h, docker stats --no-stream и повторная проверка чужих сайтов.

Обновлять приложение: `cd /opt/parsec`, `git pull --ff-only`,
`bash infra/scripts/deploy.sh`. Скрипт затрагивает только приложение Парсека;
не обновляет образ БД автоматически. Данные не удаляет. Для изменения IP
применять отдельный allowlist-скрипт. Удаление старого NPM — только если он
действительно принадлежит Парсеку и отдельно согласовано; чужие контейнеры
и «orphans» скрипт не удаляет.
