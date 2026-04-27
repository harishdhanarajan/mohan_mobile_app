import { createClient } from "npm:@supabase/supabase-js@2";

type RequestBody = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
  title?: string;
};

Deno.serve(async req => {
  try {
    const body = (await req.json()) as RequestBody;
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRole) throw new Error("Missing Supabase function secrets.");

    const supabase = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true
    });
    if (authError) throw authError;

    const profileId = `u-${Date.now()}`;
    const { error: profileError } = await supabase.from("users").insert({
      id: profileId,
      auth_user_id: authUser.user.id,
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role,
      title: body.title || (body.role === "admin" ? "Administrator" : "User")
    });
    if (profileError) throw profileError;

    return Response.json({ ok: true, profileId, authUserId: authUser.user.id });
  } catch (error) {
    return Response.json({ ok: false, error: String(error instanceof Error ? error.message : error) }, { status: 400 });
  }
});
