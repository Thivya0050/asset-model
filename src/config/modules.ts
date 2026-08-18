/**
 * Sidebar navigation config — add new modules by appending to MODULES.
 *
 * Example: add a "Maintenance" module later:
 *
 *   {
 *     id: "maintenance",
 *     label: "Maintenance",
 *     icon: Wrench,          // import from lucide-react
 *     defaultOpen: false,
 *     items: [
 *       { href: "/work-orders", label: "Work Orders", icon: ClipboardList },
 *       { href: "/schedules", label: "Schedules", icon: Calendar },
 *     ],
 *   }
 *
 * Standalone top-level links (no children) go in STANDALONE.
 */
import type { LucideIcon } from "lucide-react";
import { Boxes, Building2, LayoutDashboard, Tags, Wrench } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavModule = {
  /** Stable id used for collapse state keys */
  id: string;
  label: string;
  icon: LucideIcon;
  /** Expanded by default when the sidebar first loads */
  defaultOpen?: boolean;
  items: NavItem[];
};

/** Top-level links that are not nested under a module group */
export const STANDALONE: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
];

/**
 * Collapsible module groups. Append a new object here to add a module —
 * the sidebar renders this array; no JSX changes required.
 */
export const MODULES: NavModule[] = [
  {
    id: "assets",
    label: "Assets",
    icon: Boxes,
    defaultOpen: true,
    items: [
      { href: "/category-types", label: "Categories", icon: Tags },
      { href: "/asset-models", label: "Asset Models", icon: Boxes },
      { href: "/customers", label: "Customers", icon: Building2 },
      { href: "/customer-assets", label: "Customer Assets", icon: Wrench },
    ],
  },
  // --- Add future modules below (same shape as "assets") ---
];
