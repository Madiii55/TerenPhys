# Настройка нового проекта Firebase для TerenPhys

Сайт подключён к проекту `terenphys`, Cloud Firestore `(default)` (регион `nam5`). Данные из прежнего проекта Google AI Studio не импортируются. У нового проекта собственный список пользователей Firebase Authentication.

## Регистрация и вход

В консоли Firebase проекта `terenphys` включите Authentication → Sign-in method → Email/Password. Если нужен вход через Google, включите также Google. Добавьте домен сайта в Authentication → Settings → Authorized domains. Для локального предпросмотра проверьте разрешение localhost и 127.0.0.1. Firebase Authentication отправляет письма подтверждения и сброса пароля.

Опубликуйте `firestore.rules` для базы `(default)` через Firestore Database → Rules. Новые профили хранятся в коллекции users с ID документа, равным Firebase Authentication UID. Пароли в Firestore не хранятся.

## Авторы постов

После регистрации автора скопируйте его UID из Firebase Authentication. В Firestore создайте документ postAuthors/{UID}:

```json
{
  "grades": [7, 8],
  "isActive": true
}
```

Теперь автор сможет публиковать для 7 и 8 классов после подтверждения почты. Для 9 класса добавьте 9 в grades. Чтобы отключить публикацию, установите isActive: false. Правило Firestore проверяет эти права при создании поста.

## Прежний проект

Старый проект не изменяется и его данные не удаляются: сайт просто перестаёт к нему обращаться. Ничего из него не переносится.
