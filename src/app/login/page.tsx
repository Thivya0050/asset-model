"use client";

import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7] text-[13px] text-[#6b7280]">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
