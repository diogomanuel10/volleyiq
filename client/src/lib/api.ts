import { getIdToken } from "./firebase";

const BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!BASE_URL) return path;
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getIdToken();
  if (!token) {
    throw new Error(
      "Not signed in: no Firebase ID token available. Complete login before " +
        "calling protected endpoints, and confirm VITE_FIREBASE_* env vars " +
        "are set on the frontend host.",
    );
  }
  const res = await fetch(resolveUrl(path), {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
