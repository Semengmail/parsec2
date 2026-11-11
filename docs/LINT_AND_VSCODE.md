# Lint и VS Code

После одобренного R3 по запросу Nick устранены все 29 ошибок backend lint и
два предупреждения клиента. Правила не отключались ради зелёной проверки.
Текущий результат: оба lint — 0 ошибок/предупреждений, обе сборки проходят,
119 backend-тестов проходят.

Lint-итерация принята внешним ревью 11.11.2026: замечаний к коду нет,
lock-файлы согласованы, новых eslint-disable нет. После замечания ревьювера
дополнительно успешно пересобраны ОБА Docker-образа из текущего дерева:
backend с npm ci/build и client с новым lock-файлом, ESLint-конфигом и
NEXT_PUBLIC_STUB_MODE=true. Логи — ignored tmp/backend-lint-final-docker.log
и tmp/client-lint-final-docker.log. Запуск приложения/отправка писем не требовались.

## Команды

Из parsecback или parsecclient:

```bash
npm run lint
npm run lint:fix
npm run typecheck
```

`lint` запускает ESLint с `--max-warnings=0`, затем TypeScript без emit.
`lint:fix` применяет только доступные автоматические исправления ESLint.
Неразрешённое предупреждение также завершает lint с ненулевым кодом.

Клиент использует прямой `eslint .` со стандартным eslint:recommended,
Next Core Web Vitals и TypeScript recommended. Generated .next/out/build,
coverage, зависимости и next-env.d.ts исключены. Typecheck сначала вызывает
`next typegen`, чтобы проверка работала и до первого next build на новом clone.
Устаревший next lint больше не используется.

## Редактор

Открыть `parsec.code-workspace`, затем при необходимости выполнить
Developer: Reload Window и выбрать TypeScript: Select TypeScript Version →
Use Workspace Version. В обоих проектах сейчас установлен TypeScript 5.9.3.

Настроены:

- Рабочие каталоги ESLint отдельно для parsecback и parsecclient. Редактор
  использует те же eslint.config.mjs, что CLI, с flat config и проверкой при вводе.
- Локальный TypeScript SDK, проверка TS/JS и подсказка выбора workspace SDK.
- Prettier на сохранение, одинарные кавычки, отступ 2 и LF, как в настройках Nick;
  у клиента добавлен .prettierrc, чтобы эти параметры были явными.
- ESLint fixAll при явном сохранении. Форматирование Prettier и исправления
  ESLint — отдельные операции; полного переформатирования клиента не делали.

Для текущего открытия корня также подготовлен локальный .vscode/settings.json,
для отдельного открытия подкаталогов обновлены их локальные settings.json.
Эти файлы остаются ignored по существующему .gitignore; переносимая настройка
в Git — `parsec.code-workspace`. Корневой .gitignore и глобальные настройки
пользователя не менялись, Oxc не отключался.

## Что изменено в исходниках

Backend: удалены лишние type assertions и неиспользуемые после этого type-imports;
тип результата DataSource.query передан через generic; убран async без await
в mail-тесте; сравнение числового HTTP status с enum сделано явно; исправлено
форматирование двух участков users. Логика административных операций не менялась.

В трёх файлах modules/public-api теперь есть изменения исходного текста по
явному запросу Nick исправить lint. Прежнее утверждение «побайтовый diff пустой»
относится к состоянию R3 до этой задачи. Для всех трёх файлов сравнение AST
сгенерированного JavaScript до/после совпало с нормализацией лишних скобок.
HTTP-контракты и поведение публичного API не изменялись.

Client: добавлены стабильные store actions в зависимости useEffect у
TestBenchCaptcha; удалён неиспользуемый результат чистого вычисления.
Новый стандартный набор правил выявил неявные NBSP в JSX-тексте privacy-policy,
ReferralInfoRules и HeroBlock: они заменены на явные HTML-сущности. Сгенерированный
JavaScript этих замен совпал точно, текст и типографические переносы сохранены.

Настройки клиента проверены и на негативных примерах: unused variable и
пропущенная зависимость useEffect действительно дают ошибки; .next/types
игнорируется ESLint. Сами lint обоих проектов и build выполнены из их каталогов.

Проверены локальные build, typecheck, тесты и обе Docker-сборки после lint-only
изменений. Работающий ручной стенд с живым SMTP сохранён на контейнерах R3:
их ID/Created/StartedAt не менялись. Пересборка локальных тегов не заменяет
работающие контейнеры. Новые письма не отправлялись; коммитов/push и обращений
к серверу не было.
