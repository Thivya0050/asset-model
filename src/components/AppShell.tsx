"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Menu, PanelLeftClose, PanelLeft } from "lucide-react";
import { MODULES, STANDALONE, type NavItem } from "@/config/modules";
import { ToastProvider } from "@/components/Toast";
import { SidebarUser } from "@/components/SidebarUser";

const SIDEBAR_EXPANDED = 248;
const SIDEBAR_COLLAPSED = 64;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={`relative flex min-h-11 items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-[13px] font-medium transition-colors md:min-h-0 md:py-1.5 ${
        active
          ? "bg-[#eef2ff] text-[#4338ca]"
          : "text-[#4b5563] hover:bg-[#f3f4f6] hover:text-[#1a1d23]"
      } ${collapsed ? "justify-center px-0" : ""}`}
    >
      {active ? (
        <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r bg-[#4f46e5]" />
      ) : null}
      <Icon
        size={15}
        strokeWidth={1.75}
        className={active ? "text-[#4f46e5]" : "text-[#9ca3af]"}
      />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}

function SidebarNav({
  pathname,
  collapsed,
  openModules,
  toggleModule,
  onNavigate,
  expandThenOpen,
}: {
  pathname: string;
  collapsed: boolean;
  openModules: Record<string, boolean>;
  toggleModule: (id: string) => void;
  onNavigate?: () => void;
  expandThenOpen?: (id: string) => void;
}) {
  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
      <div className="space-y-0.5">
        {STANDALONE.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <div className="space-y-3">
        {MODULES.map((mod) => {
          const ModuleIcon = mod.icon;
          const open = openModules[mod.id] ?? true;
          const groupActive = mod.items.some((item) =>
            isActive(pathname, item.href)
          );

          return (
            <div key={mod.id}>
              <button
                type="button"
                onClick={() => {
                  if (collapsed && expandThenOpen) {
                    expandThenOpen(mod.id);
                    return;
                  }
                  toggleModule(mod.id);
                }}
                title={collapsed ? mod.label : undefined}
                className={`flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                  groupActive
                    ? "text-[#4338ca]"
                    : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1d23]"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <ModuleIcon
                  size={14}
                  strokeWidth={1.75}
                  className={groupActive ? "text-[#4f46e5]" : "text-[#9ca3af]"}
                />
                {!collapsed ? (
                  <>
                    <span className="flex-1 truncate text-left">{mod.label}</span>
                    <ChevronDown
                      size={14}
                      className={`shrink-0 text-[#9ca3af] transition-transform ${
                        open ? "rotate-0" : "-rotate-90"
                      }`}
                    />
                  </>
                ) : null}
              </button>

              {/* Expanded: show children when open. Collapsed: show leaf icons. */}
              {(collapsed || open) && (
                <div
                  className={`mt-0.5 space-y-0.5 ${
                    collapsed ? "" : "ml-1 border-l border-[#e5e7eb] pl-1.5"
                  }`}
                >
                  {mod.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MODULES.map((m) => [m.id, m.defaultOpen !== false]))
  );

  useEffect(() => {
    for (const mod of MODULES) {
      if (mod.items.some((item) => isActive(pathname, item.href))) {
        setOpenModules((prev) =>
          prev[mod.id] ? prev : { ...prev, [mod.id]: true }
        );
      }
    }
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => {
      if (mq.matches) setCollapsed(true);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const toggleModule = (id: string) => {
    setOpenModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandThenOpen = (id: string) => {
    setCollapsed(false);
    setOpenModules((prev) => ({ ...prev, [id]: true }));
  };

  const width = useMemo(
    () => (collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED),
    [collapsed]
  );

  const closeMobile = () => setMobileOpen(false);

  if (isLogin) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  return (
    <ToastProvider>
    <div className="min-h-screen bg-[#f4f5f7] text-[#1a1d23]">
      {/* Desktop sidebar */}
      <aside
        style={{ width }}
        className="fixed top-0 left-0 z-30 hidden h-full flex-col border-r border-[#e5e7eb] bg-white transition-[width] duration-200 md:flex"
      >
        <div
          className={`flex h-12 shrink-0 items-center border-b border-[#e5e7eb] ${
            collapsed ? "justify-center px-2" : "justify-between gap-2 px-3"
          }`}
        >
          {!collapsed ? (
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#6b7280]">
                Asset Management
              </p>
              <p className="truncate text-[13px] font-semibold tracking-tight text-[#1a1d23]">
                Platform
              </p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[6px] text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1d23] md:min-h-9 md:min-w-9"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <SidebarNav
          pathname={pathname}
          collapsed={collapsed}
          openModules={openModules}
          toggleModule={toggleModule}
          expandThenOpen={expandThenOpen}
        />
        <SidebarUser collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close menu"
            onClick={closeMobile}
          />
          <aside className="absolute top-0 left-0 flex h-full w-[248px] flex-col border-r border-[#e5e7eb] bg-white shadow-lg">
            <div className="flex h-12 items-center justify-between border-b border-[#e5e7eb] px-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#6b7280]">
                  Asset Management
                </p>
                <p className="text-[13px] font-semibold text-[#1a1d23]">
                  Platform
                </p>
              </div>
              <button
                type="button"
                onClick={closeMobile}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[6px] text-[#6b7280] hover:bg-[#f3f4f6]"
                aria-label="Close menu"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            <SidebarNav
              pathname={pathname}
              collapsed={false}
              openModules={openModules}
              toggleModule={toggleModule}
              onNavigate={closeMobile}
            />
            <SidebarUser collapsed={false} />
          </aside>
        </div>
      ) : null}

      {/* Main content */}
      <div
        className="min-h-screen transition-[padding-left] duration-200 md:pl-[var(--sidebar-w)]"
        style={
          {
            ["--sidebar-w" as string]: `${width}px`,
          } as React.CSSProperties
        }
      >
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-[#e5e7eb] bg-white/95 px-4 backdrop-blur md:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[6px] text-[#4b5563] hover:bg-[#f3f4f6] md:hidden"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <p className="text-[13px] font-medium text-[#6b7280]">
            Asset Management
          </p>
        </header>
        <main className="px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
    </ToastProvider>
  );
}
