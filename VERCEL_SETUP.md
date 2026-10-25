# Размещение TerenPhys

Основной сайт: https://terenphys.vercel.app. Перенос выполнен 13 октября 2026 по выбору пользователя: Vercel + Supabase.

Vercel обслуживает статический React/Vite-интерфейс. Supabase `gotlcaqzrwfitgiwmsnj` продолжает обслуживать существующие данные, Auth, Storage, Realtime и Telegram webhook. Шифры, роли, RLS, пользовательские аккаунты и SMTP не менялись. Supabase Edge Functions не используются для HTML-хостинга: [HTML там отдаётся как text/plain](https://supabase.com/docs/guides/functions/development-tips).

## Первая публикация

Официальный Vercel Drop создал проект `terenphys` в существующем Hobby workspace `maads-projects-00818246`. Загружен ZIP из 47 файлов проверенной сборки и статического `vercel.json` (маршруты и заголовки), без локальных настроек/ключей и исходного репозитория. Успех подтверждён страницей Congratulations и публичным адресом. Все 47 файлов `dist` (14 155 955 байт) совпадают по SHA-256. Корень и `/auth/confirm`, `/auth/reset-password`, `/auth/callback` возвращают текущий SPA с HTTP 200, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`. Отчёт — `build/vercel-hosting-verification.json`.

`vercel.json` задаёт Vite, `pnpm build`, `dist`, SPA rewrite и заголовки. `.vercelignore` исключает локальные настройки, а `.gitignore` исключает `.vercel/` и `build/`. `scripts/prepare-vercel-output.mjs` копирует только `dist` в Build Output API v3 с приоритетом существующих файлов над SPA rewrite.

Первая попытка входа официального Vercel CLI 63.1.2 через device flow оставила кнопку Allow Access недоступной; первая публикация выполнена через уже открытый аккаунт в Drop. Повторный штатный вход 13 октября прошёл: whoami подтвердил `madidoskozha-6606`. Рабочая папка уже привязана к существующему проекту `prj_N6GDusyTg85VzzAGs5bDwYUVcrAA`, workspace `team_4ZtVxrYIylYZW3f6FCn3lQz0`. Авторизация CLI находится в игнорируемой `build/vercel-config/`; не читать и не выводить её секреты. Не создавать второй проект через Drop: каждое использование Drop создаёт новый проект.

## Следующие обновления

В этой папке вход и привязка уже выполнены. На другом компьютере войти официальным CLI и привязать папку к существующему проекту (один раз):

```sh
npx vercel@63.1.2 login --global-config build/vercel-config
npx vercel@63.1.2 link --yes --scope maads-projects-00818246 --project terenphys --global-config build/vercel-config
```

Затем:

```sh
pnpm build
node scripts/prepare-vercel-output.mjs
npx vercel@63.1.2 deploy --prebuilt --prod --scope maads-projects-00818246 --global-config build/vercel-config
node scripts/verify-hosting.mjs https://terenphys.vercel.app build/vercel-hosting-verification.json
```

Файлы `.vercel/project.json` и данные входа CLI не добавлять в Git. Для обычного облачного Vite build параметры Supabase задаются в Vercel Environment Variables только публичными VITE-параметрами; service_role/секреты там не нужны. Текущая публикация использует проверенный локальный build.

`vercel link` добавляет временный VERCEL_OIDC_TOKEN в `.env.local`. Перед привязкой локальные настройки сохранены и затем восстановлены, параметры Supabase не потеряны. Не перезаписывать настроенный `.env.local` при повторной привязке.

## Обновление анимаций — 13 октября 2026

Удалена общая легенда «Конспекты / Пробники», значки доступности с подсказками и описаниями для экранного диктора сохранены. При выборе класса, четверти, раздела и возврате обновляется ключ учебного макета: заголовок появляется за 340 мс, основная область за 380 мс, строки за 360 мс с шагом задержки 35 мс. Анимации используют opacity/transform и отключены при prefers-reduced-motion. У строк есть мягкая подсветка при наведении/фокусе. Переключение языка не перезапускает переход.

В аккреционном шейдере направление вращения согласованно изменено для движения материи и доплеровской яркости. На главной приближающаяся светлая сторона теперь обращена влево, к тексту; размеры диска, наклон, камера и переходы фона сохранены.

Обновление опубликовано официальным CLI в существующий проект: deployment `dpl_46Wf2AwEVs96WrtQwQqKk2hZ7efu`, статус READY, alias https://terenphys.vercel.app. Все 47 файлов (14 156 982 байта) совпадают по SHA-256, корень и auth-маршруты отвечают текущим SPA и защитными заголовками без авторизации. Сборка: `main-BtZeUKel.js`, `StudyPage-AbXWdvK_.js`, `CosmicBackground-C8Xe8wjW.js`. TypeScript, все 141 тест и build прошли. Отчёт — `build/vercel-polish-hosting-verification.json`, снимки — `build/polish-*.png`.

В опубликованной версии проверены отсутствие легенды, анимации выбора класса/четверти/раздела и возврата, задержки строк 35/70/105/140 мс. При смене языка основная область сохранила итоговый transform без повторного появления. На экране 390×844 ширина и scrollWidth равны 390, значки 14×14. После мобильной перезагрузки настоящий WebGL-рендер использовал 192 шага шейдера; яркая сторона обращена к тексту. Ошибок/предупреждений консоли нет. Временный viewport сброшен, язык возвращён на RU.

Последующая публикация анимаций 13 октября: READY `dpl_9HvWLb8UQQYeMVDrb3Zp4G6AD9Px`, прежний production alias. Все 47 файлов / 10 538 340 байт совпадают со сборкой, auth-маршруты и заголовки проходят. Отчёт — `build/vercel-motion-hosting-verification.json`; детали переходов, hover и сетевой проверки — `PERFORMANCE.md`. CLI повторно не привязывался, локальные настройки не перезаписывались.

Последнее уточнение анимаций опубликовано в `dpl_EkkqfBVTW5znWpeJQ37x8th7ZWiD` (READY, прежний alias): 47 файлов / 10 539 999 байт совпадают, маршруты проходят. Актуальный отчёт — `build/vercel-sequence-hosting-verification.json`; сведения о более ранних публикациях выше исторические.

Исправление плавности опубликовано в `dpl_2LtuMkx2FMESMNp9vwvBfWyKHSKT`, READY, прежний alias. 47 файлов / 10 543 456 байт совпадают, актуальный отчёт `build/vercel-smooth-hosting-verification.json`; браузером проверены native fade, облет Telegram и положение камеры. Сведения о предыдущих публикациях выше исторические.

## Вход и письма

В Supabase Dashboard сохранён Site URL `https://terenphys.vercel.app` и три точных адреса `/auth/callback`, `/auth/confirm`, `/auth/reset-password`. Проверено после перезагрузки. Девять localhost/loopback адресов и три старых production адреса сохранены для прежних ссылок (всего 15). Шаблон подтверждения использует `{{ .SiteURL }}` и автоматически ведёт на новый сайт; Gmail SMTP и Confirm Email сохранены. `.env.production` не закрепляет старый домен: emailReturnUrl использует текущий HTTPS origin, OAuth также возвращается к начавшему вход origin. Google callback остаётся `https://gotlcaqzrwfitgiwmsnj.supabase.co/auth/v1/callback`.

Прежние `firebase.json` и `.firebaserc` удалены из рабочей конфигурации; копии сохранены в игнорируемой `build/legacy-firebase/`. Старый Firebase Hosting не удалён и не перенаправлен: `terenphys.web.app` содержит прежнюю версию. Для актуального сайта использовать новый адрес.

## Проверка опубликованной версии

В публичном браузере проверены значки четверти/разделов, Word СОЧ 8.1, PDF №42 с переходом на 2/7 и увеличением 125%, переключение RU/KK с сохранённой четвертью. На 390×844 ширина страницы и scrollWidth равны 390, значки остаются 14×14. Снимки — `build/vercel-first-quarter-*.png`, сохранённая URL Configuration — `build/vercel-supabase-urls.png`.

Реальный Google-вход существующего аккаунта владельца завершился на Vercel: `/auth/callback`, «Вход выполнен», «Всё готово». Origin — новый домен, query и hash очищены. Снимок — `build/vercel-google-login.png`. Google Cloud настройки и client secret для переноса не менялись: server callback остаётся в Supabase.

Supabase security advisor сообщает о выключенной проверке утёкших паролей; эта настройка не менялась при переносе. [Описание и настройка защиты паролей](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Политики базы и аккаунты при переносе не изменялись.
