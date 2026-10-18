import * as SecureStore from "expo-secure-store";
export type Row = Record<string, any>;
export const BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
let token: string | null = null;
export async function request(path: string, method = "GET", body?: unknown) {
  token = token || (await SecureStore.getItemAsync("mdp-demo-session"));
  const r = await fetch(`${BASE}/api/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Unable to complete this request.");
  return d;
}
export async function signIn() {
  const d = await request("demo-login", "POST", {
    actor: "resident",
    native: true,
  });
  token = d.token;
  await SecureStore.setItemAsync("mdp-demo-session", token!);
}
export async function signOut() {
  try {
    await request("logout", "POST", {});
  } finally {
    token = null;
    await SecureStore.deleteItemAsync("mdp-demo-session");
  }
}
