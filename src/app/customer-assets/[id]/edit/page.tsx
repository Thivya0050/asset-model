"use client";

import { use } from "react";
import { CustomerAssetForm } from "@/components/CustomerAssetForm";

export default function EditCustomerAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <CustomerAssetForm assetId={id} />;
}
