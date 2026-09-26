// admin-users — user management for the Air Fair dashboard.
//
// Actions (POST JSON { action, ... }), callable only by an ACTIVE ADMIN:
//   list                                  → auth users with sign-in info
//   invite     { email, fullName, role, redirectTo }
//   deactivate { userId }                 → ban sign-in + profiles.is_active = false
//   reactivate { userId }
//
// The service-role key comes from the function's environment (Supabase sets
// SUPABASE_SERVICE_ROLE_KEY automatically) and never reaches the browser.
// Role changes are made directly on public.profiles by the dashboard; RLS
// only allows admins to do that.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLES = new Set(["admin", "editor", "staff"]);
const BAN_FOREVER = "876000h"; // ~100 years

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Who is calling? (JWT from the dashboard session)
  const authHeader = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: { user }, error: userError } = await asCaller.auth.getUser();
  if (userError || !user) return json({ error: "You are not signed in." }, 401);

  // 2. Is the caller an active admin?
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: me } = await admin.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
  if (!me || me.role !== "admin" || !me.is_active) return json({ error: "Only admins can manage users." }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }

  try {
    switch (body.action) {
      case "list": {
        const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
        if (error) throw error;
        return json({
          users: data.users.map((u) => ({
            id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
            invited_at: u.invited_at, email_confirmed_at: u.email_confirmed_at, banned_until: (u as { banned_until?: string }).banned_until ?? null,
          })),
        });
      }

      case "invite": {
        const email = String(body.email ?? "").trim().toLowerCase();
        const role = String(body.role ?? "");
        const fullName = String(body.fullName ?? "").trim();
        const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : undefined;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
        if (!ROLES.has(role)) return json({ error: "Choose a role: admin, editor or staff." }, 400);
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name: fullName } });
        if (error) throw error;
        // The on_auth_user_created trigger created the profile with role 'none'.
        const { error: profileError } = await admin.from("profiles")
          .upsert({ id: data.user.id, email, full_name: fullName, role, is_active: true }, { onConflict: "id" });
        if (profileError) throw profileError;
        return json({ user: { id: data.user.id, email } });
      }

      case "deactivate":
      case "reactivate": {
        const userId = String(body.userId ?? "");
        if (!userId) return json({ error: "Missing user." }, 400);
        if (userId === user.id) return json({ error: "You can't deactivate your own account." }, 400);
        const activating = body.action === "reactivate";
        if (!activating) {
          const { data: target } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
          if (target?.role === "admin") {
            const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true);
            if ((count ?? 0) <= 1) return json({ error: "Keep at least one active admin." }, 400);
          }
        }
        const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: activating ? "none" : BAN_FOREVER });
        if (error) throw error;
        const { error: profileError } = await admin.from("profiles").update({ is_active: activating }).eq("id", userId);
        if (profileError) throw profileError;
        return json({ ok: true });
      }

      default:
        return json({ error: "Unknown action." }, 400);
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
