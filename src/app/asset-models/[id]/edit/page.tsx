"use client";

import { use } from "react";
import { AssetModelForm } from "@/components/AssetModelForm";

export default function EditAssetModelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <AssetModelForm modelId={id} />;
}
