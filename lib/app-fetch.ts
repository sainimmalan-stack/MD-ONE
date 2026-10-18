/** Explicit demo routing at each API call site; never patches global fetch or production auth. */
export function appApiUrl(path: string) {
  const demo =
    typeof window !== "undefined" &&
    /^\/demo\/?$/.test(window.location.pathname);
  return "/api/" + (demo ? "demo/" : "") + path.replace(/^\/+/, "");
}
export function appFetch(input: string, init?: RequestInit) {
  const url = input.startsWith("/api/") ? appApiUrl(input.slice(5)) : input;
  return fetch(url, { ...init, cache: "no-store" });
}
