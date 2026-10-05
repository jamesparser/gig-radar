/** Browser → /api helper. Throws ApiClientError with the server's message so UIs can show it verbatim. */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers: { "content-type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    credentials: "same-origin",
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const e = json?.error;
    throw new ApiClientError(e?.message ?? `Request failed (${res.status})`, res.status, e?.code ?? "error");
  }
  return json as T;
}
