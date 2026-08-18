/** Shared import field definitions and helpers */

export type ImportEntity =
  | "categories"
  | "asset-models"
  | "customers"
  | "customer-assets";

export type FieldDef = {
  key: string;
  label: string;
  required: boolean;
  /** aliases for auto-matching headers */
  aliases: string[];
};

export const ENTITY_LABELS: Record<ImportEntity, string> = {
  categories: "Categories",
  "asset-models": "Asset Models",
  customers: "Customers",
  "customer-assets": "Customer Assets",
};

export const IMPORT_FIELDS: Record<ImportEntity, FieldDef[]> = {
  categories: [
    {
      key: "name",
      label: "Name",
      required: true,
      aliases: ["name", "category", "category name", "category type"],
    },
    {
      key: "code",
      label: "Code",
      required: false,
      aliases: ["code", "category code", "short code"],
    },
  ],
  "asset-models": [
    {
      key: "name",
      label: "Model Name",
      required: true,
      aliases: ["model name", "name", "model", "asset model"],
    },
    {
      key: "category",
      label: "Category",
      required: true,
      aliases: ["category", "category name", "category type"],
    },
    {
      key: "manufacturer",
      label: "Manufacturer",
      required: false,
      aliases: ["manufacturer", "maker", "brand"],
    },
    {
      key: "description",
      label: "Description",
      required: false,
      aliases: ["description", "desc", "notes"],
    },
    {
      key: "defaultWarrantyMonths",
      label: "Default Warranty (months)",
      required: false,
      aliases: [
        "default warranty (months)",
        "default warranty",
        "warranty months",
        "warranty",
      ],
    },
    {
      key: "defaultStampingMonths",
      label: "Default Stamping (months)",
      required: false,
      aliases: [
        "default stamping (months)",
        "default stamping",
        "stamping months",
        "calibration months",
        "stamping",
      ],
    },
    {
      key: "unitCost",
      label: "Unit Cost",
      required: false,
      aliases: ["unit cost", "cost", "price"],
    },
  ],
  customers: [
    {
      key: "name",
      label: "Name",
      required: true,
      aliases: ["name", "customer", "customer name", "site", "site name"],
    },
  ],
  "customer-assets": [
    {
      key: "serialNumber",
      label: "Serial Number",
      required: true,
      aliases: ["serial number", "serial", "asset s/n", "s/n", "sn"],
    },
    {
      key: "assetModel",
      label: "Asset Model",
      required: true,
      aliases: ["asset model", "model", "model name"],
    },
    {
      key: "customer",
      label: "Customer",
      required: true,
      aliases: ["customer", "customer name", "site"],
    },
    {
      key: "assetStatus",
      label: "Asset Status",
      required: false,
      aliases: ["asset status", "status", "lifecycle"],
    },
    {
      key: "warrantyExpiryDate",
      label: "Warranty Expiry Date",
      required: false,
      aliases: [
        "warranty expiry date",
        "warranty expiry",
        "warranty",
        "warranty date",
      ],
    },
    {
      key: "stampingExpiryDate",
      label: "Stamping Expiry Date",
      required: false,
      aliases: [
        "stamping expiry date",
        "stamping expiry",
        "stamping",
        "calibration expiry",
      ],
    },
  ],
};

/** Optional fields shown only when Migration Mode is enabled */
export const MIGRATION_FIELDS: FieldDef[] = [
  {
    key: "updatedAt",
    label: "Updated On",
    required: false,
    aliases: [
      "updated on",
      "updated at",
      "updated",
      "date updated",
      "last updated",
      "modified on",
      "modified",
    ],
  },
  {
    key: "updatedBy",
    label: "Updated By",
    required: false,
    aliases: [
      "updated by",
      "updatedby",
      "author",
      "user",
      "modified by",
      "last updated by",
    ],
  },
];

export function fieldsForImport(
  entity: ImportEntity,
  migrationMode: boolean
): FieldDef[] {
  return migrationMode
    ? [...IMPORT_FIELDS[entity], ...MIGRATION_FIELDS]
    : IMPORT_FIELDS[entity];
}

/** Normalize for header matching: lower case, trim, collapse spaces */
export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_]+/g, " ");
}

/** Normalize lookup names: trim + case-insensitive compare key */
export function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function autoMapColumns(
  fileHeaders: string[],
  entity: ImportEntity,
  migrationMode = false
): Record<string, string> {
  const fields = fieldsForImport(entity, migrationMode);
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  for (const field of fields) {
    const aliases = field.aliases.map(normalizeHeader);
    const exact = fileHeaders.find((h) => {
      const n = normalizeHeader(h);
      return !usedHeaders.has(h) && aliases.includes(n);
    });
    if (exact) {
      mapping[field.key] = exact;
      usedHeaders.add(exact);
      continue;
    }
    // fuzzy: alias contained in header or header contained in alias
    const fuzzy = fileHeaders.find((h) => {
      if (usedHeaders.has(h)) return false;
      const n = normalizeHeader(h);
      return aliases.some(
        (a) => n === a || n.includes(a) || a.includes(n)
      );
    });
    if (fuzzy) {
      mapping[field.key] = fuzzy;
      usedHeaders.add(fuzzy);
    }
  }

  return mapping;
}

/**
 * Parse migration dates such as 2025/04/10, 2025-04-10, 10 Apr 2025, ISO.
 * Returns null if empty or unparseable.
 */
export function parseMigrationDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;

  // YYYY/MM/DD or YYYY-MM-DD (optional time)
  const ymd = s.match(
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]) - 1;
    const d = Number(ymd[3]);
    const hh = Number(ymd[4] ?? 0);
    const mm = Number(ymd[5] ?? 0);
    const ss = Number(ymd[6] ?? 0);
    const dt = new Date(y, m, d, hh, mm, ss);
    if (
      dt.getFullYear() === y &&
      dt.getMonth() === m &&
      dt.getDate() === d
    ) {
      return dt;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY (day first when day > 12 or both parts <= 12 — prefer DMY for AMS)
  const dmy = s.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]) - 1;
    const y = Number(dmy[3]);
    const hh = Number(dmy[4] ?? 0);
    const mm = Number(dmy[5] ?? 0);
    const ss = Number(dmy[6] ?? 0);
    const dt = new Date(y, m, d, hh, mm, ss);
    if (
      dt.getFullYear() === y &&
      dt.getMonth() === m &&
      dt.getDate() === d
    ) {
      return dt;
    }
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export type MappedRow = Record<string, string>;

export function applyMapping(
  rawRows: Record<string, unknown>[],
  mapping: Record<string, string>
): MappedRow[] {
  return rawRows.map((raw) => {
    const out: MappedRow = {};
    for (const [fieldKey, header] of Object.entries(mapping)) {
      if (!header) continue;
      const v = raw[header];
      out[fieldKey] =
        v == null || v === ""
          ? ""
          : typeof v === "string"
            ? v.trim()
            : String(v).trim();
    }
    return out;
  });
}
