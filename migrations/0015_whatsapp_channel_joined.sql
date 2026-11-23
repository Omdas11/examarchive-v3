-- 0015: remember that a registered user clicked Join on the WhatsApp
-- channel popup, so it stops showing for them. Guests have no account,
-- so they use localStorage (ea_whatsapp_joined) instead.
ALTER TABLE users ADD COLUMN whatsapp_channel_joined INTEGER NOT NULL DEFAULT 0;
