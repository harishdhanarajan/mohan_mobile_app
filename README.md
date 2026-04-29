# mohan_app_users

Android-first Expo app for MYT.

## Setup

1. Add these env vars in a local `.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=https://aeugzumthwtuykonfyiz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

2. Deploy the Supabase migration that adds auth-linked profiles and RLS.
3. Deploy the `create-user` Edge Function if you want admin-created users from inside the app.
4. Run `npm run android`.

## Supabase CLI flow

```powershell
cd C:\Users\Sasha\Desktop\mohan_app_users
npx supabase@latest link --project-ref aeugzumthwtuykonfyiz
npx supabase@latest db push
npx supabase@latest functions deploy create-user
```

## Auth model

- Login is handled by Supabase Auth.
- The first admin can bootstrap the workspace.
- Admin-created users require the `create-user` function or an equivalent backend flow.
