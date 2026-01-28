# Telegram Notifications for Cleanup Submissions

Optional setup to receive Telegram messages when users submit cleanups. Each notification includes:

- **Cleanup ID**
- **Wallet address** of the submitter
- **Location** (link to Google Maps + coordinates)
- **Timestamp**
- **Before / After** image links (IPFS) that you can open and expand
- **Transaction** link to Basescan (when available)

---

## 1. Create a Telegram Bot

1. Open [Telegram](https://telegram.org) and message **@BotFather**.
2. Send: `/newbot`
3. Follow the prompts: choose a name (e.g. `DeCleanup Notifications`) and a username (e.g. `decleanup_notify_bot`).
4. Copy the **token** BotFather returns (e.g. `123456789:ABCdefGHI...`). This is your `TELEGRAM_BOT_TOKEN`.

---

## 2. Choose Where to Receive Notifications

You can send to a **private chat**, a **group**, or a **channel**.

### Option A: Private Chat (just you)

1. Start a chat with your new bot: search for its username and send any message (e.g. `Hi`).
2. Get your **chat_id** (see step 3 below). For a user, it’s usually a positive number like `123456789`.

### Option B: Group

1. Create a group or use an existing one.
2. Add your bot to the group (search by username, then “Add to Group”).
3. Send a message in the group (e.g. `test`).
4. Get the **chat_id** (step 3). For groups it’s usually negative, e.g. `-987654321`.

### Option C: Channel

1. Create a channel (or use an existing one).
2. Add the bot as an **administrator** (required for posting).
3. Post a message in the channel (or have the bot post once you’re set up).
4. The **chat_id** is often `-100` followed by digits (e.g. `-1001234567890`), or you can use `@yourchannelname` in some setups. For `sendMessage`, the numeric ID is more reliable.

---

## 3. Get Your Chat ID

1. Send a message in the chat/group/channel where the bot can see it (or, for a channel, where the bot is admin and has posted or can read).
2. Call the Telegram API:

   ```text
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```

   Replace `<YOUR_BOT_TOKEN>` with the token from step 1.

3. In the JSON response, find `result[].message.chat.id` (or `result[].channel_post.chat.id` for channel posts). That value is your `TELEGRAM_CHAT_ID`.

   Example:

   ```json
   {
     "result": [{
       "message": {
         "chat": { "id": -987654321, "type": "group", "title": "DeCleanup Alerts" }
       }
     }]
   }
   ```

   Here `TELEGRAM_CHAT_ID=-987654321`.

---

## 4. Configure Environment Variables

Add these to `.env.local` (and to your production environment, e.g. Vercel):

```bash
# Telegram (optional): notifications for new cleanup submissions
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHI...
TELEGRAM_CHAT_ID=-987654321
```

**Important:**

- **Do not** use `NEXT_PUBLIC_` for these. They must stay server-side only.
- If either `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is missing, the notify API will return 503 and no notification will be sent. The cleanup submission in the app is unaffected.

---

## 5. Deploy / Restart

- **Local:** Restart the dev server after changing `.env.local`.
- **Production (e.g. Vercel):** Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in the project’s Environment Variables, then redeploy.

---

## 6. Verifier Invite Link (optional)

When a user **becomes a verifier** for the first time (stakes ≥51% of $bDCU), the app shows a success modal that invites them to join your Telegram channel or group to receive submission alerts.

The invite URL is **server-only** (`VERIFIER_TELEGRAM_INVITE_URL`, not `NEXT_PUBLIC_*`). The app calls `GET /api/verifier-telegram-invite?address=0x...`; the API checks on-chain that the address is a verifier and returns the URL only then. The link is never bundled into client code.

**Recommendation:** Use a **private Channel** (broadcast-only, clean feed). If you prefer verifiers to discuss, use a **private Group**.

1. Create a **private Channel** (or Group).
2. Add your bot as an **administrator** (so it can post submission alerts).
3. Create an **invite link**: Channel/Group info → Invite via Link → Copy (e.g. `https://t.me/+AbCdEfGhIjK`).
4. Set in `.env.local` and production (server-side only):

   ```bash
   VERIFIER_TELEGRAM_INVITE_URL=https://t.me/+YourInviteHash
   ```

If this is unset, the post‑stake modal still appears with "You're a Verifier!" and the transaction link, but the "Join Verifier Channel" button is hidden.

---
## 7. How It’s Triggered

After a user successfully submits a cleanup (on-chain, with before/after hashes and location), the app calls:

`POST /api/notify-cleanup-submission`

with a JSON body containing `cleanupId`, `submitterAddress`, `beforePhotoHash`, `afterPhotoHash`, `latitude`, `longitude`, and optionally `transactionHash`.  
The route builds the notification text and sends it via the Telegram Bot API. The call is fire‑and‑forget from the app; if Telegram fails, the submission still succeeds.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| No messages in Telegram | `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` set in the correct env (and no `NEXT_PUBLIC_`). Restart/redeploy after changes. |
| “Chat not found” | For groups: add the bot to the group. For channels: add the bot as admin. Verify `TELEGRAM_CHAT_ID` (including the minus sign for groups/channels). |
| “Unauthorized” | Token is wrong or revoked. Create a new bot with @BotFather if needed. |
| getUpdates shows nothing | Send a new message in the chat/group/channel and call `getUpdates` again. For channels, the bot must be admin. |

---

*Optional. If these are unset, cleanup submissions work as before; only the Telegram notifications are skipped.*
