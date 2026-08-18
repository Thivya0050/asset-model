"use client";

import { useSession } from "next-auth/react";
import {
  canBulkImport,
  canManageCategories,
  canWriteAssetModels,
  canWriteCustomerAssets,
  canWriteCustomers,
  isReadOnly,
} from "@/lib/roles";

export function usePermissions() {
  const { data } = useSession();
  const role = data?.user?.role;
  return {
    role,
    name: data?.user?.name,
    canManageCategories: canManageCategories(role),
    canWriteAssetModels: canWriteAssetModels(role),
    canWriteCustomers: canWriteCustomers(role),
    canWriteCustomerAssets: canWriteCustomerAssets(role),
    canBulkImport: canBulkImport(role),
    isReadOnly: isReadOnly(role),
  };
}
