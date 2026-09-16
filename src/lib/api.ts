export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** GET JSON from our own API (cookie session in the browser, Bearer token inside Discord). */
export async function getJson<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

/** POST JSON to our own API. Relative paths work inside Discord too (the root URL mapping proxies them). */
export async function postJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  return data as T;
}
