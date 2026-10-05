// admin-users — user management for the Air Fair dashboard.
//
// Actions require verified, active Team access; admin targets require an admin:
//   list                                  → auth users with sign-in info
//   invite     { email, fullName, role, redirectTo }
//   deactivate { userId }                 → ban sign-in + profiles.is_active = false
//   reactivate { userId }
//
// The service-role key comes from the function's environment (Supabase sets
// SUPABASE_SERVICE_ROLE_KEY automatically) and never reaches the browser.
// Role changes are made directly on public.profiles by the dashboard; RLS
// enforces Team access and administrator-specific guards.
import { createClient } from "npm:@supabase/supabase-js@2";
import { invitationRedirect } from "../_shared/auth/redirect.ts";

import { allowedOrigins, corsHeaders } from "../_shared/inbox/core.ts";
import { isUuid, readJsonObject, publicFailure } from "../_shared/auth/http.ts";
const origins = allowedOrigins(Deno.env.get("EXTRA_ALLOWED_ORIGINS") || "");

const ROLES = new Set(["admin", "editor", "staff"]);
const BAN_FOREVER = "876000h"; // ~100 years

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get("origin") || "", origins);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return json({});
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Who is calling? (JWT from the dashboard session)
  const authHeader = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: { user }, error: userError } = await asCaller.auth.getUser();
  if (userError || !user) return json({ error: "You are not signed in." }, 401);

  // 2. Managing the team needs Team access (any role can be given it on the
  //    Team page). Anything involving an admin account still needs an admin.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: callerRole, error: roleError } = await asCaller.rpc("auth_role");
  if (roleError || !["admin", "editor", "staff"].includes(callerRole)) return json({ error: "Only verified, active team members can manage users." }, 403);
  const { data: teamAccess } = await admin.rpc("section_allowed", { p_user: user.id, p_key: "team" });
  if (teamAccess !== true) return json({ error: "You need Team access to manage users." }, 403);
  const callerIsAdmin = callerRole === "admin";

  const body = await readJsonObject(req, 16000);
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
        let redirectTo: string;
        try { redirectTo = invitationRedirect(body.redirectTo, Deno.env.get("SITE_URL") || "https://airfairtravel.com", Deno.env.get("AUTH_REDIRECT_ORIGINS") || ""); }
        catch { return json({ error: "Invitation redirect is not allowed." }, 400); }
        if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
        if (fullName.length > 200) return json({ error: "Name must be at most 200 characters." }, 400);
        if (!ROLES.has(role)) return json({ error: "Choose a role: admin, editor or staff." }, 400);
        if (role === "admin" && !callerIsAdmin) return json({ error: "Only an admin can invite another admin." }, 403);
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
        if (!isUuid(userId)) return json({ error: "Invalid user ID." }, 400);
        if (userId === user.id) return json({ error: "You can't deactivate your own account." }, 400);
        const activating = body.action === "reactivate";
        const { data: target, error: targetError } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
        if (targetError) throw targetError;
        if (!target) return json({ error: "User not found." }, 404);
        if (target.role === "admin" && !callerIsAdmin) return json({ error: "Only an admin can deactivate or reactivate an admin." }, 403);
        if (!activating) {
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
    console.error(JSON.stringify({ fn: "admin-users", stage: "request_failed" }));
    const failure = publicFailure(err, "Could not complete user management. Please retry.");
    return json(failure.body, failure.status);
  }
});
