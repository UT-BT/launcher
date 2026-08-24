# Birthday calendar and inbox API contract

The launcher expects the authenticated API contract below. Birthday and notification data is server-owned; the client does not use local storage as a fallback.

## Profile birthday

`GET /users/me` may include:

```json
{ "birthday": { "day": 14, "month": 8, "visible": true } }
```

`PUT /users/me/birthday` accepts `{ "birthday": { "day": 14, "month": 8, "visible": true } }` or `{ "birthday": null }` and returns `{ "birthday": ... }` in the normal success envelope. The year is never collected.

## Calendar

`GET /calendar?from=2026-08-01&to=2026-08-31` returns `{ "items": [...] }`. Items use one of these shapes:

```json
{
  "type": "birthday",
  "date": "2026-08-14",
  "user_id": "123",
  "alias": "Player",
  "active_title": null,
  "greeting_emoji": null
}
```

```json
{
  "type": "event",
  "date": "2026-08-16",
  "event": { "id": "1", "slug": "summer-cup", "name": "Summer Cup" }
}
```

Only visible birthdays are returned. `greeting_emoji` is the current user's already-sent greeting for that birthday occurrence, if one exists.

## Greetings

`POST /birthdays/{user_id}/greeting` accepts `{ "date": "2026-08-14", "emoji": "🎉" }` and returns `{ "birthday": <updated calendar birthday> }`.

The API must reject self-greetings, unsupported emoji values, and dates that are not the target user's current birthday occurrence. A later request from the same sender for the same recipient and occurrence replaces the selected emoji; it must not create another greeting or notification. Duplicate concurrent requests must not create duplicates.

Allowed emoji values are `🎉`, `🎂`, `🥳`, `❤️`, and `💐`.

## Inbox

`GET /notifications` returns `{ "items": [...] }`, newest first or unsorted. The launcher sorts them by `created_at`.

```json
{
  "id": "notification-id",
  "type": "birthday_greeting",
  "actor_user_id": "123",
  "actor_alias": "Player",
  "actor_title": null,
  "emoji": "🎉",
  "created_at": "2026-08-14T12:00:00Z",
  "read_at": null
}
```

`POST /notifications/read` marks all current notifications as read without removing them and returns `{ "updated": 3 }`.

`DELETE /notifications/{id}` explicitly removes one notification and returns `{ "deleted": true }`.

Notifications must remain available across logout, application restarts, and later logins until the recipient deletes them. Sending a greeting and creating its notification must succeed or fail together.
