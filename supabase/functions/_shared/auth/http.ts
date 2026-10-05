export class RequestError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export const isUuid = (value: unknown): value is string => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// Count actual bytes, including chunked requests with no Content-Length.
export async function readTextBody(req: Request, maxBytes: number): Promise<string> {
  if (Number(req.headers.get("content-length")) > maxBytes) throw new RequestError("Request too large.", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new RequestError("Invalid request body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestError("Request too large.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch { throw new RequestError("Invalid request body."); }
}

export async function readJsonObject(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const text = await readTextBody(req, maxBytes);
  try {
    const body = JSON.parse(text);
    if (body === null || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new RequestError("Invalid request body."); }
}

export function publicFailure(error: unknown, fallback = "Request failed. Please try again.") {
  return { status: error instanceof RequestError ? error.status : 500,
    body: { error: error instanceof RequestError ? error.message : fallback } };
}
