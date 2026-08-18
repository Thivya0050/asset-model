"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SidebarUser({ collapsed }: { collapsed: boolean }) {
  const { data } = useSession();
  const user = data?.user;
  if (!user) return null;

  return (
    <div
      className={`shrink-0 border-t border-[#e5e7eb] ${
        collapsed ? "px-1.5 py-2" : "px-2.5 py-2.5"
      }`}
    >
      {!collapsed ? (
        <div className="mb-2 min-w-0 px-0.5">
          <p className="truncate text-[12px] font-medium text-[#1a1d23]">
            {user.name}
          </p>
          <p className="truncate text-[11px] text-[#6b7280]">{user.role}</p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        title="Sign out"
        className={`flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-[12px] font-medium text-[#4b5563] hover:bg-[#f3f4f6] hover:text-[#1a1d23] ${
          collapsed ? "justify-center px-0" : ""
        }`}
      >
        <LogOut size={14} className="shrink-0 text-[#9ca3af]" />
        {!collapsed ? <span>Sign out</span> : null}
      </button>
    </div>
  );
}
