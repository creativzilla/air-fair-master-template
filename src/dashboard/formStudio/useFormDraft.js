// Loads a form document and keeps its draft saved while the admin edits:
// debounced autosave, one save at a time (a slow response can never
// overwrite newer edits), undo/redo, a local backup of unsaved edits (offered
// back after a failed save, a crash or a closed tab), and publishing.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConflictError, docStatus, getDocument, publishDocuments, saveDraft } from "../api.js";
import { normalizeSchema, validateForPublish } from "../../../supabase/functions/_shared/forms/schema.ts";

const AUTOSAVE_MS = 900;
const RETRY_MS = [3000, 10000, 30000];
const HISTORY_LIMIT = 100;
const backupKey = id => `af-form-studio:${id}`;

function readBackup(id) {
  try { return JSON.parse(window.localStorage.getItem(backupKey(id)) || "null"); } catch { return null; }
}
function writeBackup(id, schema, revision) {
  try { window.localStorage.setItem(backupKey(id), JSON.stringify({ schema, revision, at: new Date().toISOString() })); } catch { /* storage full or blocked */ }
}
function clearBackup(id) {
  try { window.localStorage.removeItem(backupKey(id)); } catch { /* ignore */ }
}

// status: loading | saved | pending (edits waiting) | saving | failed | conflict
export function useFormDraft(docId) {
  const [doc, setDoc] = useState(null);
  const [schema, setSchemaState] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState(null);
  const [recovery, setRecovery] = useState(null); // backup offered on open
  const history = useRef({ past: [], future: [] });
  const [, setHistoryVersion] = useState(0); // re-render when undo/redo availability changes
  const setHistory = next => { history.current = next; setHistoryVersion(v => v + 1); };

  const docRef = useRef(null);
  const schemaRef = useRef(null);
  const savedJson = useRef("");
  const inFlight = useRef(false);
  const timer = useRef(null);
  const retries = useRef(0);
  const lastEdit = useRef({ key: null, at: 0 });

  const load = useCallback(async () => {
    setStatus("loading"); setError("");
    try {
      const fresh = await getDocument(docId);
      const normalized = normalizeSchema(fresh.draft || {});
      docRef.current = fresh;
      schemaRef.current = normalized;
      // Normalizing only fills in ids that older forms derive from their keys, so
      // the form counts as saved; the ids are stored with the first real edit.
      savedJson.current = JSON.stringify(normalized);
      setDoc(fresh);
      setSchemaState(normalized);
      setHistory({ past: [], future: [] });
      const backup = readBackup(docId);
      if (backup?.schema && JSON.stringify(backup.schema) !== JSON.stringify(normalized)) setRecovery(backup);
      else if (backup) clearBackup(docId);
      setStatus("saved");
    } catch (err) {
      setError(err.message || "Could not load this form.");
      setStatus("failed");
    }
  }, [docId]);

  useEffect(() => { load(); }, [load]);

  const saveNow = useCallback(async () => {
    clearTimeout(timer.current);
    if (!docRef.current || !schemaRef.current) return;
    if (inFlight.current) return; // the running save schedules another one if needed
    const snapshot = schemaRef.current;
    const json = JSON.stringify(snapshot);
    if (json === savedJson.current) { setStatus("saved"); return; }
    inFlight.current = true;
    setStatus("saving");
    try {
      const saved = await saveDraft(docRef.current, { draft: snapshot });
      docRef.current = saved;
      savedJson.current = json;
      retries.current = 0;
      setDoc(saved);
      setSavedAt(new Date());
      setError("");
      if (JSON.stringify(schemaRef.current) === json) { setStatus("saved"); clearBackup(docId); }
      else { setStatus("pending"); timer.current = setTimeout(() => saveNow(), AUTOSAVE_MS); }
    } catch (err) {
      if (err instanceof ConflictError) {
        setStatus("conflict");
        setError("This form was changed somewhere else (another tab or admin). Your edits are kept here.");
      } else {
        setStatus("failed");
        setError(/permission|42501|row-level/i.test(err?.message || "") ? "You don't have permission to edit forms. Only admins can." : (err?.message || "Couldn't save."));
        const wait = RETRY_MS[Math.min(retries.current, RETRY_MS.length - 1)];
        retries.current += 1;
        if (retries.current <= RETRY_MS.length) timer.current = setTimeout(() => saveNow(), wait);
      }
    } finally {
      inFlight.current = false;
    }
  }, [docId]);

  // Autosave when the loaded form needed ids (legacy forms) or after edits.
  useEffect(() => {
    if (status === "pending" && !inFlight.current) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => saveNow(), AUTOSAVE_MS);
    }
  }, [status, saveNow]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Every edit goes through here. `mergeKey`: consecutive edits with the same
  // key within a second (typing in one box) become one undo step.
  const setSchema = useCallback((next, mergeKey = null) => {
    const prev = schemaRef.current;
    if (!prev || next === prev) return;
    const now = Date.now();
    const merge = mergeKey && lastEdit.current.key === mergeKey && now - lastEdit.current.at < 1000;
    lastEdit.current = { key: mergeKey, at: now };
    const h = history.current;
    setHistory({ past: merge ? h.past : [...h.past, prev].slice(-HISTORY_LIMIT), future: [] });
    schemaRef.current = next;
    setSchemaState(next);
    writeBackup(docId, next, docRef.current?.draft_revision);
    if (status !== "conflict") {
      setStatus(s => (s === "saving" ? s : "pending"));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => saveNow(), AUTOSAVE_MS);
    }
  }, [docId, saveNow, status]);

  const apply = useCallback(next => {
    schemaRef.current = next;
    setSchemaState(next);
    writeBackup(docId, next, docRef.current?.draft_revision);
    lastEdit.current = { key: null, at: 0 };
    setStatus("pending");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveNow(), AUTOSAVE_MS);
  }, [docId, saveNow]);
  const undo = useCallback(() => {
    const h = history.current;
    if (!h.past.length) return;
    const previous = h.past[h.past.length - 1];
    setHistory({ past: h.past.slice(0, -1), future: [schemaRef.current, ...h.future] });
    apply(previous);
  }, [apply]);
  const redo = useCallback(() => {
    const h = history.current;
    if (!h.future.length) return;
    const [next, ...rest] = h.future;
    setHistory({ past: [...h.past, schemaRef.current], future: rest });
    apply(next);
  }, [apply]);

  const retry = useCallback(() => { retries.current = 0; saveNow(); }, [saveNow]);

  // Conflict: keep mine (save on top of the latest revision) or take theirs.
  const keepMine = useCallback(async () => {
    try {
      const latest = await getDocument(docId);
      docRef.current = latest;
      savedJson.current = JSON.stringify(latest.draft || {});
      setStatus("pending");
      setError("");
    } catch (err) { setError(err.message); }
  }, [docId]);
  const takeTheirs = useCallback(async () => { clearBackup(docId); setRecovery(null); await load(); }, [docId, load]);

  const restoreRecovery = useCallback(() => {
    if (!recovery?.schema) return;
    setSchema(normalizeSchema(recovery.schema));
    setRecovery(null);
  }, [recovery, setSchema]);
  const dismissRecovery = useCallback(() => { clearBackup(docId); setRecovery(null); }, [docId]);

  // Wait for every edit to be saved (used before publishing).
  const flush = useCallback(async () => {
    for (let i = 0; i < 40; i++) {
      if (!inFlight.current && JSON.stringify(schemaRef.current) === savedJson.current) return true;
      if (!inFlight.current) await saveNow();
      else await new Promise(r => setTimeout(r, 150));
    }
    return JSON.stringify(schemaRef.current) === savedJson.current;
  }, [saveNow]);

  const publish = useCallback(async () => {
    const problems = validateForPublish(schemaRef.current);
    if (problems.length) return { ok: false, problems };
    const saved = await flush();
    if (!saved) return { ok: false, problems: [{ message: "Your latest changes aren't saved yet, so they can't be published. Check the save status and try again." }] };
    await publishDocuments([docRef.current.id], "Published from the Form Studio");
    const fresh = await getDocument(docId);
    docRef.current = fresh;
    setDoc(fresh);
    return { ok: true, problems: [] };
  }, [docId, flush]);

  const renameForm = useCallback(async title => {
    const saved = await saveDraft(docRef.current, { title });
    docRef.current = saved;
    setDoc(saved);
  }, []);

  // Warn before leaving with unsaved edits.
  const unsaved = status === "pending" || status === "saving" || status === "failed" || status === "conflict";
  useEffect(() => {
    if (!unsaved) return undefined;
    const warn = e => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const publishState = useMemo(() => docStatus(doc), [doc]);

  return {
    doc, schema, setSchema, status, error, savedAt, unsaved, publishState,
    canUndo: history.current.past.length > 0, canRedo: history.current.future.length > 0, undo, redo,
    retry, keepMine, takeTheirs, recovery, restoreRecovery, dismissRecovery, publish, flush, renameForm, reload: load,
  };
}
