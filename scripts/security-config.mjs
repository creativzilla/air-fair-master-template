// VITE variables become public build output. Reject accidental additions and
// privileged Supabase keys before starting Vite; never include values in errors.
const PUBLIC_KEYS=new Set(['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','VITE_SITE_URL','VITE_OG_IMAGE','VITE_GA_ID']);
export function validatePublicEnv(env) {
  for(const [key,value] of Object.entries(env)) {
    if(!key.startsWith('VITE_')) continue;
    if(!PUBLIC_KEYS.has(key)) throw new Error(`Unapproved browser environment variable: ${key}. Review it before adding it to the public allowlist.`);
    if(/^sb_secret_|^re_/.test(value||'')) throw new Error(`Private credential detected in ${key}. Use a server-only secret.`);
  }
  const key=env.VITE_SUPABASE_ANON_KEY;
  if(key && !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    let role;
    try { role=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8')).role; } catch { /* reject below */ }
    if(role!=='anon') throw new Error('VITE_SUPABASE_ANON_KEY must be a public anon or publishable key.');
  }
}

export const securityHeaders={
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'X-Frame-Options':'SAMEORIGIN',
  // Preserve existing analytics, images, chat scripts and same-origin previews.
  // This is baseline containment, not a comprehensive script-src XSS policy.
  'Content-Security-Policy':"base-uri 'self'; object-src 'none'; frame-ancestors 'self'",
};
