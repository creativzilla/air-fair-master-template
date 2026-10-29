import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { Button, LabeledInput, LabeledSelect, Notice, T } from "./ui.jsx";

export default function PipelineStagesEditor({ rows, stageNames = [], onSaved }) {
  const [draft, setDraft] = useState([]);
  const [baseline, setBaseline] = useState(rows);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data, error: loadError } = await supabase.from("pipeline_stages").select("*").order("sort_order").order("id");
        if (loadError) throw loadError;
        if (!active) return;
        setBaseline(data);
        // The board uses default stages when no configuration has been saved yet.
        const initial = data.length ? data : stageNames.map(name => ({ name }));
        setDraft(initial.map(row => ({ ...row, key: row.id || crypto.randomUUID() })));
      } catch (err) {
        if (active) setError(`Could not load stages: ${err.message}. Close and reopen this editor to retry.`);
      } finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, []);
  const change = next => { setDraft(next); setSaved(false); };
  const move = (index, offset) => {
    const next = [...draft];
    const [stage] = next.splice(index, 1);
    next.splice(index + offset, 0, stage);
    change(next);
  };
  const save = async () => {
    const stages = draft.map(row => ({ id: row.id || null, name: row.name.trim() }));
    setError(""); setSaved(false);
    if (stages.length < 2) { setError("Keep at least two stages."); return; }
    if (stages.some(row => !row.name || row.name.length > 80)) { setError("Each stage needs a name of 1–80 characters."); return; }
    if (new Set(stages.map(row => row.name.toLowerCase())).size !== stages.length) { setError("Stage names must be unique."); return; }
    setBusy(true);
    try {
      const { data, error: saveError } = await supabase.rpc("configure_pipeline_stages", {
        expected_stages: baseline.map(({ id, name, sort_order }) => ({ id, name, sort_order })),
        next_stages: stages,
      });
      if (saveError) throw saveError;
      onSaved(data, baseline);
      setBaseline(data);
      setDraft(data.map(row => ({ ...row, key: row.id })));
      setSaved(true);
    } catch (err) {
      setError(err.code === "PGRST202" ? "Stage editing needs the latest database migration. Please apply the pipeline stages migration and try again." : err.message || "Could not save stages. Try again.");
    } finally { setBusy(false); }
  };
  return <div className="flex flex-col gap-4">
    <p className="text-sm" style={{ color: T.muted }}>All pipeline stages are listed below. Drag a handle to change the order, or choose a position. Add stages as needed, then click Save stages. Position 1 is the leftmost column.</p>
    {loading && <p role="status">Loading stages…</p>}
    <fieldset disabled={busy || loading} className="flex flex-col gap-3 min-w-0">
      {draft.map((row, index) => <div key={row.key} data-stage-key={row.key} className="flex items-end gap-2 flex-wrap rounded-lg p-2" style={{ border: `1px solid ${dropTarget === row.key ? T.accent : T.border}`, backgroundColor: dropTarget === row.key ? T.accentSoft : T.surface, opacity: dragging === row.key ? 0.6 : 1 }}>
        <button type="button" aria-label={`Drag ${row.name || "new stage"} to reorder`} className="p-2 self-center cursor-grab active:cursor-grabbing" style={{ touchAction: "none", color: T.muted }}
          onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); setDragging(row.key); setDropTarget(row.key); }}
          onPointerMove={event => { if (dragging !== row.key) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-stage-key]"); if (target) setDropTarget(target.dataset.stageKey); }}
          onPointerUp={event => { if (dragging !== row.key) return; const from = draft.findIndex(item => item.key === dragging); const to = draft.findIndex(item => item.key === dropTarget); if (from >= 0 && to >= 0 && from !== to) move(from, to - from); setDragging(null); setDropTarget(null); event.currentTarget.releasePointerCapture(event.pointerId); }}
          onPointerCancel={() => { setDragging(null); setDropTarget(null); }}><GripVertical size={18} /></button>
        <div className="flex-1 min-w-0"><LabeledInput label={`Stage ${index + 1}`} value={row.name} onChange={name => change(draft.map(item => item.key === row.key ? { ...item, name } : item))} /></div>
        <div className="w-20"><LabeledSelect label="Position" value={String(index)} onChange={value => move(index, Number(value) - index)} options={draft.map((_, position) => ({ value: String(position), label: String(position + 1) }))} /></div>
        <Button small tone="outline" icon={ArrowUp} title={`Move ${row.name || "stage"} earlier`} disabled={index === 0 || busy} onClick={() => move(index, -1)} />
        <Button small tone="outline" icon={ArrowDown} title={`Move ${row.name || "stage"} later`} disabled={index === draft.length - 1 || busy} onClick={() => move(index, 1)} />
        <Button small tone="outline" icon={Trash2} title={`Remove ${row.name || "stage"}`} disabled={draft.length <= 2 || busy} onClick={() => change(draft.filter(item => item.key !== row.key))} />
      </div>)}
      <div><Button disabled={loading || !!error && draft.length === 0} tone="outline" icon={Plus} onClick={() => change([...draft, { key: crypto.randomUUID(), name: "" }])}>Add stage</Button></div>
    </fieldset>
    {error && <Notice tone="danger">{error}</Notice>}
    {saved && <Notice tone="info">Pipeline stages saved.</Notice>}
    <div><Button busy={busy} disabled={loading || draft.length < 2 || !!dragging} onClick={save}>Save stages</Button></div>
  </div>;
}
