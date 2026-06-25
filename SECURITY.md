# Security Notes

The admin editor reads `VITE_ADMIN_PASSCODE` from local environment configuration. For local editing, create an uncommitted `.env.local` file and set your own passcode there.

For production, protect `/admin` with Cloudflare Access or another hosting-level access layer. Do not rely on a client-side passcode as real security.
