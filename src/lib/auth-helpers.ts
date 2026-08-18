import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { AppRole } from "@/lib/roles";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

/** Require an authenticated session. Returns 401 Response or the user. */
export async function requireUser(): Promise<
  SessionUser | NextResponse
> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || !u.email || !u.name || !u.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as AppRole,
  };
}

/** Require auth + role predicate. Returns 401/403 or the user. */
export async function requirePermission(
  allowed: (role: AppRole) => boolean
): Promise<SessionUser | NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (!allowed(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

export function isErrorResponse(
  value: SessionUser | NextResponse
): value is NextResponse {
  return value instanceof NextResponse;
}
