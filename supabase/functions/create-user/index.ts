// Edge Function: create-user
// Admin-only user lifecycle operations against Supabase Auth + public.users.
//
// Actions:
//   create           → { name, email, password, role, title } → creates auth user + profile row
//   update_password  → { auth_user_id, password }             → resets the auth user's password
//   delete           → { auth_user_id, profile_id }           → deletes the auth user and its profile row
//
// Caller must be an authenticated admin (verified by JWT + public.users.role === 'admin').

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE_ROLE =
      Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
      return json({ error: "Function is missing required environment variables." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header." }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Invalid authorization." }, 401);
    }

    const { data: callerProfile, error: profileErr } = await userClient
      .from("users")
      .select("role")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();
    if (profileErr) return json({ error: profileErr.message }, 500);
    if (!callerProfile || callerProfile.role !== "admin") {
      return json({ error: "Only admins can manage users." }, 403);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = (body as { action?: string })?.action;

    if (action === "create") {
      const { name, email, password, role, title } = body as {
        name?: string;
        email?: string;
        password?: string;
        role?: string;
        title?: string;
      };
      if (!name || !email || !password) {
        return json({ error: "name, email, password are required." }, 400);
      }
      const cleanEmail = String(email).trim().toLowerCase();

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true
      });
      if (createErr || !created?.user) {
        return json({ error: createErr?.message || "Could not create auth user." }, 400);
      }

      const profile = {
        id: "u-" + Date.now(),
        auth_user_id: created.user.id,
        name: String(name).trim(),
        email: cleanEmail,
        password: "managed-by-supabase-auth",
        role: role === "admin" ? "admin" : "user",
        title: typeof title === "string" ? title : ""
      };

      const { error: insertErr } = await admin.from("users").insert(profile);
      if (insertErr) {
        await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
        return json({ error: insertErr.message }, 400);
      }

      return json({ user: profile });
    }

    if (action === "update_password") {
      const { auth_user_id, password } = body as { auth_user_id?: string; password?: string };
      if (!auth_user_id || !password) {
        return json({ error: "auth_user_id and password are required." }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(auth_user_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      const { auth_user_id, profile_id } = body as { auth_user_id?: string; profile_id?: string };
      if (auth_user_id) {
        const { error } = await admin.auth.admin.deleteUser(auth_user_id);
        if (error && error.message && !/not.*found/i.test(error.message)) {
          return json({ error: error.message }, 400);
        }
      }
      if (profile_id) {
        const { error } = await admin.from("users").delete().eq("id", profile_id);
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
