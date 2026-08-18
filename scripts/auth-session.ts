/**
 * Obtain a NextAuth session cookie for scripted API calls (migration / tests).
 */
export async function fetchSessionCookie(
  baseUrl: string,
  email: string,
  password: string
): Promise<string> {
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfRes.ok) {
    throw new Error(`CSRF fetch failed: ${csrfRes.status}`);
  }
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  // Deduplicate so the CSRF cookie matching csrfToken wins (last Set-Cookie).
  const csrfCookies = mergeCookies(collectCookies(csrfRes));

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    redirect: "false",
    json: "true",
    callbackUrl: `${baseUrl}/`,
  });

  const signRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookies,
    },
    body,
    redirect: "manual",
  });

  const all = mergeCookies(csrfCookies, collectCookies(signRes));
  if (!all.includes("authjs.session-token") && !all.includes("__Secure-authjs.session-token")) {
    const text = await signRes.text().catch(() => "");
    throw new Error(
      `Login failed (${signRes.status}). Check credentials. ${text.slice(0, 200)}`
    );
  }
  return all;
}

function collectCookies(res: Response): string {
  const anyHeaders = res.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : [];
  if (setCookies.length) {
    return setCookies.map((c) => c.split(";")[0]).join("; ");
  }
  const single = res.headers.get("set-cookie");
  if (!single) return "";
  return single.split(/,(?=\s*[^;]+=)/).map((c) => c.split(";")[0].trim()).join("; ");
}

/** Last value wins per cookie name (important when Auth.js sets csrf-token twice). */
function mergeCookies(...parts: string[]): string {
  const map = new Map<string, string>();
  for (const part of parts) {
    for (const pair of part.split("; ")) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
    }
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
