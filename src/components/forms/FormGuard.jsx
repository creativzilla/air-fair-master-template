import React, { useRef } from "react";

// Spam guard for public forms: a hidden field people never see (bots fill
// it in) and the time taken to fill the form. Both are checked on the server
// (form-submit Edge Function); a bot gets a normal "thank you" and nothing is
// saved or emailed.
export function useFormGuard() {
  const startedAt = useRef(Date.now());
  const inputRef = useRef(null);
  const honeypot = (
    <div className="af-hp" aria-hidden="true">
      <label>
        Company website
        <input ref={inputRef} type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
  const guard = () => ({ company_website: inputRef.current?.value || "", elapsed_ms: Date.now() - startedAt.current });
  return { honeypot, guard };
}
