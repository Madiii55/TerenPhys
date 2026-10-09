# Supabase Auth — TerenPhys
Проект: gotlcaqzrwfitgiwmsnj (организация TerenPhys, регион ap-northeast-1).
Firebase SDK и Firestore больше не используются. Старые аккаунты и данные не перенесены.
Firebase Hosting можно использовать отдельно от базы; firebase.json содержит только хостинг.

## Окружение
Скопировать .env.example в .env.local и указать Project URL и sb_publishable_… key.
Никаких secret/service_role ключей в клиенте, Git или чате.
VITE_PUBLIC_SITE_URL задаёт реальный публичный адрес для ссылок из писем.
В `.env.production` указан `https://terenphys.web.app`; production-сборка использует этот адрес для писем.
В разработке без этого значения ссылки используют текущий локальный адрес.

## Что применено
Через Supabase plugin применены миграции terenphys_profiles_posts_storage и post_snapshot_default.
supabase/schema.sql — итоговый снимок схемы для нового пустого проекта, НЕ запускать повторно поверх текущей базы.
Профили приватны: владелец видит и редактирует только свою строку.
Email и пароли обслуживает Supabase Auth; email не копируется в публичные таблицы.
Сервер проверяет подтверждение почты по auth.users, а не по редактируемому user_metadata.
post_authors изменяет только администратор. Автор может писать только в назначенные активные классы.
Имя автора и время публикации заполняет сервер. Посты доступны для чтения всем.
Аватарки публичны для отображения в постах, загрузка/замена доступны только владельцу.
Бакет avatars: JPEG, до 512 KiB, путь UUID/profile.jpg. Приложение сжимает изображение.
Realtime включён для posts. Типы src/types/database.ts сгенерированы из рабочей базы.

## Настройки Dashboard
Через plugin нельзя менять URL Configuration, Google OAuth и SMTP; URL Configuration настроена через Dashboard.
3 октября 2026 проверено: Email включён, Confirm Email включён, Google выключен.
4 октября 2026 в Dashboard Site URL заменён на `https://terenphys.web.app` и добавлены три production Redirect URLs. Девять локальных адресов сохранены. Минимальная длина пароля на сервере — 8 символов.
Настройки:
https://supabase.com/dashboard/project/gotlcaqzrwfitgiwmsnj/auth/url-configuration

Site URL: https://terenphys.web.app
Разрешённые Redirect URLs:
- https://terenphys.web.app/auth/callback
- https://terenphys.web.app/auth/confirm
- https://terenphys.web.app/auth/reset-password
- http://localhost:4173/auth/callback
- http://localhost:4173/auth/confirm
- http://localhost:4173/auth/reset-password
- http://127.0.0.1:4173/auth/callback
- http://127.0.0.1:4173/auth/confirm
- http://127.0.0.1:4173/auth/reset-password
Для pnpm dev также добавлены эти три пути на http://localhost:3000.
Всего сохранены 12 точных Redirect URLs. При смене публичного домена обновить Site URL и эти три production-пути.
Приложение нормализует числовые loopback-адреса в localhost до загрузки SDK.
Локальная ссылка не открывает ваш компьютер с другого устройства.

## Подтверждение, OAuth и сброс пароля
Приложение использует PKCE. /auth/confirm показывает подтверждение почты, /auth/callback возвращает Google-вход,
/auth/reset-password запрашивает новый пароль после проверки recovery-ссылки.
Коды/токены удаляются из адресной строки. Произвольные continueUrl/next не используются.
Без настроенных шаблонов PKCE-ссылка требует тот же браузер, где начата регистрация или сброс.
Если почта подтверждена на другом устройстве, можно войти по почте и паролю.
Для межустройственной проверки после подключения SMTP использовать в письмах token_hash:
Подтверждение: {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email
Сброс: {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery
Не подставлять настоящий код вместо переменной. Обработчик verifyOtp уже реализован.
Отключить link tracking в SMTP-сервисе. Перед массовым запуском проверить реальные письма.
Блокировка регистрации: не отключать Confirm Email. Минимальный пароль в Dashboard уже выставлен 8 символов.
8 октября 2026 включён Google-провайдер. Создан отдельный Google Cloud Web OAuth-клиент `TerenPhys Supabase Web` в проекте terenphys. Старый Firebase-клиент не изменён.
Client ID: `894795566304-t0ocbruqob1gt18p5rt57e55kf7dequ4.apps.googleusercontent.com` (публичный идентификатор, не секрет).
Client Secret сохранён только в Google-провайдере Supabase, не в приложении или репозитории.
Authorized JavaScript origins: `https://terenphys.web.app`, `http://localhost:4173`, `http://localhost:3000`.
Google redirect URI: `https://gotlcaqzrwfitgiwmsnj.supabase.co/auth/v1/callback` — это callback Supabase, не `/auth/callback` сайта.
Google consent Audience: External / In production. Scopes: `openid`, `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/userinfo.profile`.
Skip nonce checks и Allow users without an email не включать. Google-вход не использует SMTP; подтверждение адреса возвращает Google. Confirm Email для парольного входа остаётся включён.
Secure password change включён: сессия старше 24 часов требует повторной аутентификации перед сменой пароля. Форма восстановления использует свежую recovery-сессию и 30-минутный UI-маркер; для просроченной сессии предлагает новую recovery-ссылку. Require current password when updating не включён, чтобы не сломать восстановление забытого пароля.

## Письма и бесплатный тариф
4 октября 2026 в Dashboard повторно проверено: Custom SMTP не настроен; редактирование шаблонов требует подключения SMTP.
Встроенный SMTP предназначен для тестов и отправляет только участникам команды.
Новые Free-проекты с 3 июня 2026 не могут менять шаблоны без собственного SMTP.
Для регистрации посетителей и брендированных писем требуется SMTP-сервис.
Секреты SMTP вводить непосредственно в Authentication → Emails → SMTP Settings.
Для адреса своего домена подтвердить домен у почтового провайдера и настроить выданные DNS-записи.
Не гарантировать попадание во входящие без проверки реальных писем.

## Проверки
8 октября 2026 исправлена клиентская логика авторизации:
- Запросы профиля привязаны к ID аккаунта и версии сессии. Смена аккаунта/выход немедленно отменяют применение старых ответов.
- Верифицированная сессия отделена от профиля. Сбой базы не превращает успешный вход в ошибку пароля; профиль можно загрузить повторно.
- Восстановление после обновления страницы использует 30-минутный UI-маркер в sessionStorage, привязанный к user ID и session_id. Токены и пароли в маркер не входят. Маркер не даёт прав: getUser проверяет серверную сессию, updateUser и RLS проверяет Supabase. Выход, смена аккаунта и успешная смена пароля очищают маркер.
- Таймеры повторной отправки сохраняются отдельно для регистрации и сброса; кнопки блокируют повторный запрос и переключение режима во время отправки.
- Google-кнопки отображаются только при включённом серверном провайдере. OAuth возвращается на исходный origin, чтобы PKCE не терялся между localhost и публичным сайтом.
- Выход относится к текущей сессии (scope: local), не выводит пользователя из других устройств; ошибка выхода отображается.
- Сообщения для сброса и Google-входа разделены, обновлён русский/казахский интерфейс.
- OAuth-ошибки на корневом Site URL тоже перехватываются и очищаются из адресной строки; пользователю не показываются сырые error_description. Обновление уже завершённого callback проверяет серверную сессию, а не расходует код повторно.
- tests/authLifecycle.test.ts проверяет реальный AuthProvider и формы с изолированной моделью SDK: никаких писем, паролей или аккаунтов в рабочую базу эти тесты не отправляют.

pnpm lint, pnpm test, pnpm build.
supabase/security-check.sql проверяет RLS внутри транзакции и завершает её rollback.
Тестовые аккаунты, профили, посты и фотографии в рабочей базе не остаются.
Проверены анонимное чтение постов, отсутствие публичного доступа к профилям,
изоляция профилей, запрет самоназначения автором, запрет чужого класса/автора и неподтверждённого аккаунта.
Это не заменяет пользовательскую проверку доставки письма, Google OAuth и восстановления пароля.
8 октября 2026 подтверждён реальный Google-вход на terenphys.web.app: возврат через /auth/callback, сообщение «Вход выполнен», открытие приватного профиля, сохранение сессии после обновления страницы. Первую устаревшую OAuth-ссылку заменили свежей, не увеличивая время жизни state и не отключая его проверку. После финального Hosting-деплоя проверен безопасный показ OAuth-ошибки на корневом URL и очистка параметров из адресной строки. Автоматизированные тесты не создают тестовых пользователей; реальная проверка использует аккаунт владельца с его согласия.
Итог: 119 тестов прошли; TypeScript и production-сборка прошли. Supabase Security Advisors не нашли замечаний к RLS/таблицам; после реального входа появилась одна Auth-рекомендация: Leaked Password Protection Disabled. Эта функция требует Pro, платный тариф не подключён. Это не означает проверку реальной доставки recovery/confirmation-писем без SMTP.

## Отдельные этапы усиления защиты
CAPTCHA (Turnstile/hCaptcha) пока не настроена: необходимы ключи провайдера и проверка виджета вместе с серверной настройкой. Нельзя включать серверную CAPTCHA без клиентской интеграции.
Интерфейс двухфакторной аутентификации (TOTP) пока не реализован. Проверка утёкших паролей в Supabase доступна на Pro; платный тариф не подключён.

Официальные инструкции:
https://supabase.com/docs/guides/auth/redirect-urls
https://supabase.com/docs/guides/auth/auth-smtp
https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier
https://supabase.com/docs/guides/auth/social-login/auth-google
