// Interactive preview of a form schema with the website's own renderer
// (validation and conditional fields work; nothing is ever sent).
import React, { useMemo, useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { T, fontBody, Panel } from "../ui.jsx";
import { FormBody, submitElementOf, useFormRunner } from "../../components/forms/FormRenderer.jsx";
import { normalizeSchema } from "../../../supabase/functions/_shared/forms/schema.ts";

export function PreviewCanvas({ schema, device }) {
  const runner = useFormRunner(schema);
  const [checked, setChecked] = useState(false);
  const footer = (
    <>
      <button className="green-button svc-submit-btn" type="submit">{submitElementOf(schema)?.text || schema.submitLabel || "Submit"}</button>
      {checked && <p className="svc-privacy-note" role="status">Everything checks out. This is a preview, so nothing was sent.</p>}
      {schema.privacyNote && <p className="svc-privacy-note">{schema.privacyNote}</p>}
    </>
  );
  return (
    <form noValidate onSubmit={e => { e.preventDefault(); setChecked(!!runner.validate()); }}>
      <FormBody schema={schema} values={runner.values} errors={runner.errors} onChange={(k, v) => { setChecked(false); runner.onChange(k, v); }}
        footer={footer} numbered={schema.layout === "sections"} device={device === "mobile" ? "mobile" : undefined} />
    </form>
  );
}

const DEVICES = [["desktop", Monitor, 620], ["tablet", Tablet, 520], ["mobile", Smartphone, 375]];

// Panel used on the service editor's Form tab.
export default function FormPreviewPanel({ form, titleVars = {} }) {
  const [device, setDevice] = useState("desktop");
  const schema = useMemo(() => normalizeSchema(form || {}), [form]);
  const fill = text => (text || "").replace(/\{(\w+)\}/g, (m, k) => titleVars[k] ?? m);
  const width = DEVICES.find(d => d[0] === device)[2];
  return (
    <Panel className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium" style={{ color: T.ink, ...fontBody }}>Live preview</h3>
        <div className="flex gap-1">
          {DEVICES.map(([key, Icon]) => (
            <button key={key} type="button" onClick={() => setDevice(key)} className="p-1.5 rounded-md" aria-pressed={device === key} aria-label={`${key} preview`}
              style={{ backgroundColor: device === key ? T.accentSoft : "transparent" }}><Icon size={16} style={{ color: device === key ? T.accent : T.muted }} /></button>
          ))}
        </div>
      </div>
      <p className="text-xs" style={{ color: T.muted, ...fontBody }}>Try the fields: conditional questions appear as you answer. Nothing is submitted.</p>
      <div className="travel-site mx-auto w-full" style={{ maxWidth: width, background: "transparent" }}>
        <div className="svc-form-card">
          <div className="svc-form-head"><h3>{fill(schema.title)}</h3>{schema.description && <p>{schema.description}</p>}</div>
          <PreviewCanvas key={JSON.stringify(schema).length} schema={schema} device={device} />
        </div>
      </div>
    </Panel>
  );
}
