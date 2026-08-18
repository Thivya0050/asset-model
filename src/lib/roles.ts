/** Role-based access helpers — enforce on UI and API. */

export type AppRole = "Admin" | "Manager" | "Staff" | "Viewer";

export function isReadOnly(role?: string | null): boolean {
  return role === "Staff" || role === "Viewer";
}

export function canManageCategories(role?: string | null): boolean {
  return role === "Admin";
}

export function canWriteAssetModels(role?: string | null): boolean {
  return role === "Admin" || role === "Manager";
}

export function canWriteCustomers(role?: string | null): boolean {
  return role === "Admin" || role === "Manager";
}

export function canWriteCustomerAssets(role?: string | null): boolean {
  return role === "Admin" || role === "Manager";
}

export function canBulkImport(role?: string | null): boolean {
  return role === "Admin";
}
