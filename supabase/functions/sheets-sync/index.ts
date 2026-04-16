import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type SupportedTable = "orders" | "order_items";
type Operation = "INSERT" | "UPDATE" | "DELETE" | "FULL_SYNC";

type TableConfig = {
  schema: "public";
  table: SupportedTable;
  sheetTab: string;
  primaryKey: "id";
  columns: string[];
  numericColumns: Set<string>;
  moneyColumns: Set<string>;
};

type WebhookPayload = Record<string, unknown>;
type DataRow = Record<string, unknown>;

type LogLevel = "info" | "warn" | "error";

const TABLE_CONFIG: Record<SupportedTable, TableConfig> = {
  orders: {
    schema: "public",
    table: "orders",
    sheetTab: "orders",
    primaryKey: "id",
    columns: [
      "id",
      "created_at",
      "updated_at",
      "stripe_checkout_session_id",
      "stripe_payment_intent_id",
      "stripe_customer_id",
      "customer_email",
      "customer_name",
      "currency",
      "subtotal_amount",
      "total_amount",
      "status",
      "notes",
      "raw_checkout_session",
    ],
    numericColumns: new Set(["subtotal_amount", "total_amount"]),
    moneyColumns: new Set(["subtotal_amount", "total_amount"]),
  },
  order_items: {
    schema: "public",
    table: "order_items",
    sheetTab: "order_items",
    primaryKey: "id",
    columns: [
      "id",
      "order_id",
      "created_at",
      "lookup_key",
      "stripe_price_id",
      "product_name",
      "category",
      "garment",
      "design",
      "size",
      "quantity",
      "unit_amount",
      "line_total",
    ],
    numericColumns: new Set(["quantity", "unit_amount", "line_total"]),
    moneyColumns: new Set(["unit_amount", "line_total"]),
  },
};

let cachedGoogleAccessToken: { token: string; expiresAt: number } | null = null;
let cachedSheetIds: Map<string, number> | null = null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function log(level: LogLevel, message: string, details: Record<string, unknown> = {}): void {
  console[level === "error" ? "error" : "log"](
    JSON.stringify({
      level,
      message,
      ...details,
      timestamp: new Date().toISOString(),
    }),
  );
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getGooglePrivateKey(): string {
  const value = Deno.env.get("GOOGLE_PRIVATE_KEY")
    ?.replace(/\\r\\n/g, "\n")
    ?.replace(/\\n/g, "\n");
  if (!value) {
    throw new Error("Missing required environment variable: GOOGLE_PRIVATE_KEY");
  }

  return value;
}

function normalizeTableName(raw: unknown): string {
  if (typeof raw !== "string") {
    return "";
  }

  return raw.replace(/^public\./, "").trim().toLowerCase();
}

function extractTable(payload: WebhookPayload): SupportedTable | null {
  const candidates = [
    payload.table,
    payload.table_name,
    payload.target_table,
    payload.entity,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeTableName(candidate);
    if (normalized === "orders" || normalized === "order_items") {
      return normalized;
    }
  }

  return null;
}

function extractOperation(payload: WebhookPayload): Operation | null {
  const candidates = [
    payload.operation,
    payload.type,
    payload.event_type,
    payload.eventType,
    payload.op,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const normalized = candidate.toUpperCase();
    if (
      normalized === "INSERT" ||
      normalized === "UPDATE" ||
      normalized === "DELETE" ||
      normalized === "FULL_SYNC"
    ) {
      return normalized;
    }
  }

  return null;
}

function extractRecordId(payload: WebhookPayload, operation: Operation): string | null {
  const candidateObjects = operation === "DELETE"
    ? [payload.old_record, payload.old, payload.record, payload.new]
    : [payload.record, payload.new, payload.old_record, payload.old];

  for (const candidateObject of candidateObjects) {
    if (candidateObject && typeof candidateObject === "object" && "id" in candidateObject) {
      const id = (candidateObject as Record<string, unknown>).id;
      if (id !== null && id !== undefined && String(id).trim() !== "") {
        return String(id);
      }
    }
  }

  const scalarCandidates = [payload.id, payload.record_id, payload.pk];
  for (const candidate of scalarCandidates) {
    if (candidate !== null && candidate !== undefined && String(candidate).trim() !== "") {
      return String(candidate);
    }
  }

  return null;
}

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, "")
    .replace(/-----END [A-Z ]*PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

async function signJwtRS256(payload: Record<string, unknown>, clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claims = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    ...payload,
  };

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claims))}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken),
  );

  return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function getGoogleAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedGoogleAccessToken && now < cachedGoogleAccessToken.expiresAt) {
    return cachedGoogleAccessToken.token;
  }

  const clientEmail = requireEnv("GOOGLE_CLIENT_EMAIL");
  const privateKey = getGooglePrivateKey();

  const assertion = await signJwtRS256({}, clientEmail, privateKey);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to obtain Google access token: ${response.status} ${text}`);
  }

  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error("Google token response did not include access_token");
  }

  const expiresInSeconds = data.expires_in ?? 3600;
  cachedGoogleAccessToken = {
    token: data.access_token,
    expiresAt: now + (Math.max(120, expiresInSeconds - 60) * 1000),
  };

  return data.access_token;
}

async function googleSheetsRequest(pathAndQuery: string, options: RequestInit = {}): Promise<Response> {
  const spreadsheetId = requireEnv("GOOGLE_SPREADSHEET_ID");
  const accessToken = await getGoogleAccessToken();

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${pathAndQuery}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    },
  );

  return response;
}

async function getSheetIdByTabName(tabName: string): Promise<number> {
  if (!cachedSheetIds) {
    const response = await googleSheetsRequest("?fields=sheets.properties(sheetId,title)");
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to load sheet metadata: ${response.status} ${text}`);
    }

    const payload = await response.json() as {
      sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
    };

    cachedSheetIds = new Map<string, number>();
    for (const sheet of payload.sheets ?? []) {
      const title = sheet.properties?.title;
      const sheetId = sheet.properties?.sheetId;
      if (title && typeof sheetId === "number") {
        cachedSheetIds.set(title, sheetId);
      }
    }
  }

  const sheetId = cachedSheetIds.get(tabName);
  if (sheetId === undefined) {
    throw new Error(`Could not find sheet tab '${tabName}'`);
  }

  return sheetId;
}

async function getSheetValues(range: string): Promise<string[][]> {
  const encodedRange = encodeURIComponent(range);
  const response = await googleSheetsRequest(`/values/${encodedRange}`);

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to read sheet range ${range}: ${response.status} ${text}`);
  }

  const payload = await response.json() as { values?: string[][] };
  return payload.values ?? [];
}

async function appendSheetRow(tabName: string, row: Array<string | number>): Promise<void> {
  const range = `${tabName}!A:A`;
  const encodedRange = encodeURIComponent(range);
  const response = await googleSheetsRequest(
    `/values/${encodedRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values: [row] }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to append row in tab ${tabName}: ${response.status} ${text}`);
  }
}

async function clearSheetRange(range: string): Promise<void> {
  const encodedRange = encodeURIComponent(range);
  const response = await googleSheetsRequest(`/values/${encodedRange}:clear`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to clear sheet range ${range}: ${response.status} ${text}`);
  }
}

async function updateSheetRow(tabName: string, rowIndex: number, row: Array<string | number>): Promise<void> {
  const startColumn = "A";
  const endColumn = toColumnLetter(row.length);
  const range = `${tabName}!${startColumn}${rowIndex}:${endColumn}${rowIndex}`;
  const encodedRange = encodeURIComponent(range);

  const response = await googleSheetsRequest(
    `/values/${encodedRange}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ values: [row] }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update row ${rowIndex} in tab ${tabName}: ${response.status} ${text}`);
  }
}

async function deleteSheetRow(tabName: string, rowIndex: number): Promise<void> {
  const sheetId = await getSheetIdByTabName(tabName);

  const response = await googleSheetsRequest(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to delete row ${rowIndex} in tab ${tabName}: ${response.status} ${text}`);
  }
}

function toColumnLetter(columnNumber: number): string {
  let value = columnNumber;
  let result = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

async function ensureHeaderRow(config: TableConfig): Promise<void> {
  const range = `${config.sheetTab}!A1:${toColumnLetter(config.columns.length)}1`;
  const rows = await getSheetValues(range);
  const existing = rows[0] ?? [];

  const matches =
    existing.length === config.columns.length &&
    config.columns.every((value, index) => existing[index] === value);

  if (matches) {
    return;
  }

  const encodedRange = encodeURIComponent(range);
  const response = await googleSheetsRequest(
    `/values/${encodedRange}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ values: [config.columns] }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to ensure header for tab ${config.sheetTab}: ${response.status} ${text}`);
  }
}

async function findSheetRowByPrimaryKey(config: TableConfig, recordId: string): Promise<number | null> {
  const rows = await getSheetValues(`${config.sheetTab}!A2:A`);

  for (let index = 0; index < rows.length; index += 1) {
    const firstCell = rows[index]?.[0] ?? "";
    if (String(firstCell) === String(recordId)) {
      return index + 2;
    }
  }

  return null;
}

function normalizeCellValue(config: TableConfig, column: string, value: unknown): string | number {
  if (value === null || value === undefined) {
    return "";
  }

  if (column === "raw_checkout_session") {
    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  if (config.numericColumns.has(column)) {
    const normalizeNumber = (input: number): number => {
      if (config.moneyColumns.has(column)) {
        return input / 100;
      }

      return input;
    };

    if (typeof value === "number") {
      return normalizeNumber(value);
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") {
        return "";
      }

      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed)) {
        return normalizeNumber(parsed);
      }
    }
  }

  return String(value);
}

function mapRowToSheetValues(config: TableConfig, row: DataRow): Array<string | number> {
  return config.columns.map((column) => normalizeCellValue(config, column, row[column]));
}

function getSupabaseAdminClient() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function fetchCanonicalRow(config: TableConfig, recordId: string): Promise<DataRow | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from(config.table)
    .select(config.columns.join(","))
    .eq(config.primaryKey, recordId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch canonical row ${config.table}.${recordId}: ${error.message}`);
  }

  return (data as DataRow | null) ?? null;
}

async function fetchAllCanonicalRows(config: TableConfig): Promise<DataRow[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from(config.table)
    .select(config.columns.join(","))
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch rows for ${config.table}: ${error.message}`);
  }

  return (data as DataRow[] | null) ?? [];
}

async function fullSyncTable(config: TableConfig): Promise<{ actionTaken: string; rowCount: number }> {
  const rows = await fetchAllCanonicalRows(config);
  const values: Array<Array<string | number>> = [
    config.columns,
    ...rows.map((row) => mapRowToSheetValues(config, row)),
  ];

  await clearSheetRange(`${config.sheetTab}!A:ZZ`);

  const endColumn = toColumnLetter(config.columns.length);
  const range = `${config.sheetTab}!A1:${endColumn}${values.length}`;
  const encodedRange = encodeURIComponent(range);
  const response = await googleSheetsRequest(
    `/values/${encodedRange}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ values }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to write full sync for ${config.sheetTab}: ${response.status} ${text}`);
  }

  return {
    actionTaken: "full_sync",
    rowCount: rows.length,
  };
}

async function handleInsertOrUpdate(config: TableConfig, operation: "INSERT" | "UPDATE", recordId: string): Promise<string> {
  const row = await fetchCanonicalRow(config, recordId);
  if (!row) {
    throw new Error(`Canonical row not found for ${config.table}.${recordId}`);
  }

  const sheetRow = mapRowToSheetValues(config, row);
  const existingRowIndex = await findSheetRowByPrimaryKey(config, recordId);

  if (existingRowIndex === null) {
    await appendSheetRow(config.sheetTab, sheetRow);
    return operation === "INSERT" ? "append" : "append_missing_row";
  }

  await updateSheetRow(config.sheetTab, existingRowIndex, sheetRow);
  return operation === "INSERT" ? "update_existing_row" : "update";
}

async function handleDelete(config: TableConfig, recordId: string): Promise<string> {
  const existingRowIndex = await findSheetRowByPrimaryKey(config, recordId);

  if (existingRowIndex === null) {
    return "delete_noop_missing_row";
  }

  await deleteSheetRow(config.sheetTab, existingRowIndex);
  return "delete";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  let payload: WebhookPayload;

  try {
    payload = await req.json() as WebhookPayload;
  } catch {
    return jsonResponse({ error: "Malformed JSON payload" }, 400);
  }

  const table = extractTable(payload);
  const operation = extractOperation(payload);

  if (!table) {
    return jsonResponse(
      {
        error: "Unsupported or missing table. Supported tables: orders, order_items.",
      },
      400,
    );
  }

  if (!operation) {
    return jsonResponse(
      {
        error: "Unsupported or missing operation. Supported operations: INSERT, UPDATE, DELETE, FULL_SYNC.",
      },
      400,
    );
  }

  const recordId = operation === "FULL_SYNC" ? null : extractRecordId(payload, operation);
  if (operation !== "FULL_SYNC" && !recordId) {
    return jsonResponse({ error: "Missing record id in payload" }, 400);
  }

  const config = TABLE_CONFIG[table];

  log("info", "Starting sheet sync", {
    table,
    operation,
    recordId,
  });

  try {
    await ensureHeaderRow(config);

    if (operation === "FULL_SYNC") {
      const result = await fullSyncTable(config);

      log("info", "Sheet full sync complete", {
        table,
        operation,
        recordId: null,
        actionTaken: result.actionTaken,
        rowCount: result.rowCount,
      });

      return jsonResponse({
        ok: true,
        table,
        operation,
        recordId: null,
        actionTaken: result.actionTaken,
        rowCount: result.rowCount,
      });
    }

    const safeRecordId = recordId as string;
    const actionTaken = operation === "DELETE"
      ? await handleDelete(config, safeRecordId)
      : await handleInsertOrUpdate(config, operation, safeRecordId);

    log("info", "Sheet sync complete", {
      table,
      operation,
      recordId,
      actionTaken,
    });

    return jsonResponse({
      ok: true,
      table,
      operation,
      recordId,
      actionTaken,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    log("error", "Sheet sync failed", {
      table,
      operation,
      recordId,
      error: message,
    });

    return jsonResponse(
      {
        ok: false,
        table,
        operation,
        recordId,
        error: message,
      },
      500,
    );
  }
});
