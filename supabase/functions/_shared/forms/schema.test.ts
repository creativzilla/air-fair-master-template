// Tests for the shared form schema (Form Studio, website renderer and server
// validation). Run: npm run test:email
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkSubmission, elementId, formatAnswer, inlineParts, inputFields, normalizeSchema, uniqueKey, validateForPublish,
  validateValue, visibleIds, walk, type FormSchema,
} from "./schema.ts";

const legacy: FormSchema = {
  title: "Apply", layout: "sections",
  sections: [{
    id: "personal", title: "Personal",
    fields: [
      { name: "fullName", label: "Full name", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "hasSponsor", label: "Do you have a sponsor?", type: "yesno", required: true },
      { name: "sponsorName", label: "Sponsor name", type: "text", required: true, showWhen: { field: "hasSponsor", equals: "Yes" } },
    ],
  }],
};

const modern: FormSchema = normalizeSchema({
  schemaVersion: 2, title: "Inquiry",
  sections: [{
    id: "s1", title: "",
    fields: [
      { id: "h1", type: "heading", text: "Tell us about you", level: 3 },
      { id: "row1", type: "row", columns: 2, children: [
        [{ id: "f_name", type: "text", name: "fullName", label: "Full name", required: true, mapTo: "fullName" }],
        [{ id: "f_mail", type: "email", name: "email", label: "Email", required: true, mapTo: "email" }],
      ] },
      { id: "f_topic", type: "select", name: "topic", label: "Topic", required: true, options: [{ label: "Visa", value: "visa" }, { label: "Tour", value: "tour" }], mapTo: "service" },
      { id: "f_extras", type: "checkboxGroup", name: "extras", label: "Extras", options: ["Insurance", "Hotel"] },
      { id: "f_count", type: "number", name: "travelers", label: "Travelers", validation: { min: 1, max: 9 } },
      { id: "f_passport", type: "file", name: "passport", label: "Passport", required: true, file: { accept: [".pdf", "image/*"], maxMB: 2 }, showWhen: { fieldId: "f_topic", equals: "visa" } },
      { id: "f_addr", type: "address", name: "address", label: "Address" },
      { id: "f_src", type: "hidden", name: "campaign", label: "Campaign", default: "autumn" },
      { id: "f_ok", type: "consent", name: "agree", label: "I agree", required: true },
      { id: "f_msg", type: "textarea", name: "message", label: "Message", mapTo: "message", validation: { maxLength: 20 } },
      { id: "sub", type: "submit", text: "Send" },
    ],
  }],
});

test("legacy forms get key-derived stable ids; existing ids are kept", () => {
  const n = normalizeSchema(legacy);
  const ids = inputFields(n).map(elementId);
  assert.deepEqual(ids, ["k_fullName", "k_email", "k_hasSponsor", "k_sponsorName"]);
  assert.equal(normalizeSchema(n).sections![0].fields![0].id, "k_fullName", "normalizing twice changes nothing");
  assert.equal(n.schemaVersion, 2);
  // renaming the key afterwards keeps the stored id
  const renamed = structuredClone(n);
  renamed.sections![0].fields![0].name = "clientName";
  assert.equal(elementId(renamed.sections![0].fields![0]), "k_fullName");
});

test("walk includes row children in document order", () => {
  assert.deepEqual(walk(modern).map(l => l.id).slice(0, 5), ["h1", "row1", "f_name", "f_mail", "f_topic"]);
  assert.equal(inputFields(modern).length, 10);
});

test("unique keys and duplicate detection", () => {
  assert.equal(uniqueKey("fullName", new Set(["fullName", "fullName2"])), "fullName3");
  assert.equal(uniqueKey("Your Email!", new Set()), "yourEmail");
  const dup = structuredClone(modern);
  dup.sections![0].fields![2].name = "email";
  assert.ok(validateForPublish(dup).some(p => /internal key "email"/.test(p.message)));
  assert.deepEqual(validateForPublish(modern), []);
  const missing = structuredClone(modern);
  (missing.sections![0].fields![5].showWhen as { fieldId: string }).fieldId = "gone";
  assert.ok(validateForPublish(missing).some(p => /no longer exists/.test(p.message)));
  const noChoices = structuredClone(modern);
  noChoices.sections![0].fields![2].options = [];
  assert.ok(validateForPublish(noChoices).some(p => /at least one choice/.test(p.message)));
});

test("visibility: conditions by key (legacy) and by field id; dependents of hidden fields hide too", () => {
  const n = normalizeSchema(legacy);
  assert.ok(!visibleIds(n, { hasSponsor: "No" }).has("k_sponsorName"));
  assert.ok(visibleIds(n, { hasSponsor: "Yes" }).has("k_sponsorName"));
  assert.ok(!visibleIds(modern, { topic: "tour" }).has("f_passport"));
  assert.ok(visibleIds(modern, { topic: "visa" }).has("f_passport"));
  const chain: FormSchema = normalizeSchema({ sections: [{ id: "s", fields: [
    { id: "a", type: "yesno", name: "a", label: "A" },
    { id: "b", type: "yesno", name: "b", label: "B", showWhen: { fieldId: "a", equals: "Yes" } },
    { id: "c", type: "text", name: "c", label: "C", showWhen: { fieldId: "b", equals: "Yes" } },
  ] }] });
  assert.ok(!visibleIds(chain, { a: "No", b: "Yes" }).has("c"), "b is hidden, so its stale value doesn't show c");
});

test("field validation rules", () => {
  const f = (o: object) => ({ type: "text", name: "x", label: "X", ...o });
  assert.equal(validateValue(f({ required: true }), "  "), "This field is required.");
  assert.equal(validateValue(f({ type: "email" }), "nope"), "Enter a valid email address.");
  assert.equal(validateValue(f({ type: "tel" }), "+63 917 123 4567"), null);
  assert.equal(validateValue(f({ type: "number", validation: { min: 1 } }), "0"), "Must be at least 1.");
  assert.equal(validateValue(f({ type: "date" }), "2026-02-30x"), "Enter a valid date.");
  assert.equal(validateValue(f({ type: "select", options: ["A"] }), "B"), "Choose from the listed options.");
  assert.equal(validateValue(f({ validation: { pattern: "[A-Z]{2}\\d{4}", patternMessage: "Use AB1234" } }), "ab1234"), "Use AB1234");
  assert.equal(validateValue(f({ type: "consent", required: true }), false), "Please tick this box to continue.");
  assert.equal(validateValue(f({ type: "address", required: true }), { line1: "1 Main", city: "Manila" }), "Enter street, city and country.");
  assert.equal(validateValue(f({ type: "address" }), { line1: "1 Main", evil: "x" }), "Invalid address.");
});

test("server check: stores answers by field id, maps contact fields, applies hidden defaults", () => {
  const r = checkSubmission(modern, {
    fullName: " Ana Cruz ", email: "ana@example.com", topic: "tour", extras: ["Hotel"], travelers: "2",
    address: { line1: "1 Main St", city: "Manila", country: "Philippines" }, campaign: "spoofed", agree: true, message: "Hi",
    service_name: "Bali", submitted_at: "2026-10-01T00:00:00Z",
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.answers.f_name, "Ana Cruz");
  assert.equal(r.answers.f_count, 2);
  assert.equal(r.answers.f_src, "autumn", "hidden field value comes from the schema, not the browser");
  assert.deepEqual(r.mapped, { fullName: "Ana Cruz", email: "ana@example.com", service: "tour", message: "Hi" });
  assert.deepEqual(Object.keys(r.context).sort(), ["service_name", "submitted_at"]);
  assert.ok(!("f_passport" in r.answers), "conditional file field hidden for tours");
});

test("server check: unknown fields, required + conditional, choice and file rules", () => {
  const base = { fullName: "Ana", email: "ana@example.com", agree: true };
  assert.deepEqual(checkSubmission(modern, { ...base, topic: "tour", isAdmin: true }).unknownKeys, ["isAdmin"]);
  const visa = checkSubmission(modern, { ...base, topic: "visa" });
  assert.equal(visa.errors.passport, "Please attach a file.", "required only when visible");
  const bigFile = checkSubmission(modern, { ...base, topic: "visa" }, [{ field: "passport", path: "submissions/2026-10/abcdef12-p.pdf", name: "p.pdf", size: 5 * 1024 * 1024, type: "application/pdf" }]);
  assert.equal(bigFile.errors.passport, "File is larger than 2 MB.");
  const badType = checkSubmission(modern, { ...base, topic: "visa" }, [{ field: "passport", path: "submissions/2026-10/abcdef12-p.exe", name: "p.exe", size: 100, type: "application/x-msdownload" }]);
  assert.equal(badType.errors.passport, "This file type isn't allowed.");
  const good = checkSubmission(modern, { ...base, topic: "visa" }, [{ field: "passport", path: "submissions/2026-10/abcdef12-p.pdf", name: "p.pdf", size: 1000, type: "application/pdf" }]);
  assert.equal(good.ok, true);
  assert.deepEqual(good.answers.f_passport, { file: "submissions/2026-10/abcdef12-p.pdf", name: "p.pdf", size: 1000, type: "application/pdf" });
  assert.deepEqual(checkSubmission(modern, { ...base, topic: "tour" }, [{ field: "message", path: "x", name: "x", size: 1, type: "" }]).unknownKeys, ["file:message"]);
  assert.equal(checkSubmission(modern, { ...base, topic: "cruise" }).errors.topic, "Choose from the listed options.");
  assert.equal(checkSubmission(modern, { ...base, topic: "tour", extras: ["Spa"] }).errors.extras, "Choose from the listed options.");
  assert.equal(checkSubmission(modern, { ...base, topic: "tour", message: "x".repeat(21) }).errors.message, "Use at most 20 characters.");
  assert.equal(checkSubmission(modern, { fullName: "Ana", email: "ana@example.com", topic: "tour" }).errors.agree, "Please tick this box to continue.");
});

test("legacy forms keep working with the server check", () => {
  const n = normalizeSchema(legacy);
  const r = checkSubmission(n, { fullName: "Ana", email: "ana@example.com", hasSponsor: "No", sponsorName: "ignored", service_slug: "9g" });
  assert.equal(r.ok, true);
  assert.equal(r.values.sponsorName, undefined, "hidden answers are dropped");
  assert.deepEqual(r.answers, { k_fullName: "Ana", k_email: "ana@example.com", k_hasSponsor: "No" });
});

test("answer formatting and safe paragraph links", () => {
  const topic = inputFields(modern).find(f => f.name === "topic");
  assert.equal(formatAnswer(topic, "visa"), "Visa");
  assert.equal(formatAnswer(undefined, ["a", "b"]), "a, b");
  assert.equal(formatAnswer(undefined, { line1: "1 Main", city: "Manila", country: "PH" }), "1 Main, Manila, PH");
  assert.equal(formatAnswer(undefined, { file: "p", name: "passport.pdf" }), "passport.pdf");
  assert.deepEqual(inlineParts("See [policy](/privacy) or [x](javascript:alert(1))"), [
    { text: "See " }, { text: "policy", href: "/privacy" }, { text: " or " }, { text: "[x](javascript:alert(1)" }, { text: ")" },
  ]);
});

test("phone numbers: common formats accepted, junk refused", () => {
  const f = { type: "tel", name: "phone", label: "Phone" };
  for (const ok of ["+63 917 123 4567", "0917-123-4567", "(02) 8123 4567", "+63 917 123 4567 ext 12", "0917 123 4567 / Viber", "+1 (555) 010-9999 x45"]) {
    assert.equal(validateValue(f, ok), null, ok);
  }
  for (const bad of ["12345", "call me", "+63917<script>", "1".repeat(25)]) assert.equal(validateValue(f, bad), "Enter a valid phone number.", bad);
});
