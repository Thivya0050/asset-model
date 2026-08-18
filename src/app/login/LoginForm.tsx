"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Incorrect email or password");
        return;
      }
      router.replace(callbackUrl.startsWith("/") ? callbackUrl : "/");
      router.refresh();
    } catch {
      setError("Incorrect email or password");
    } finally {
      setLoading(false);
    }
  };

  const input =
    "mt-1 w-full rounded-[6px] border border-[#e5e7eb] bg-white px-2.5 py-2 text-[13px] outline-none focus:border-[#4f46e5]";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7] px-4">
      <div className="w-full max-w-sm rounded-[6px] border border-[#e5e7eb] bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#6b7280]">
            Asset Management
          </p>
          <h1 className="mt-1 text-[18px] font-semibold tracking-tight text-[#1a1d23]">
            Sign in
          </h1>
          <p className="mt-1 text-[13px] text-[#6b7280]">
            Use your account email and password.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              className={input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              className={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error ? (
            <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="btn-touch w-full rounded-[6px] bg-[#4f46e5] px-3 py-2 text-[13px] font-medium text-white hover:bg-[#4338ca] disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
