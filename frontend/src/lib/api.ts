import type {
  DashboardSummary,
  DnsRecord,
  HostedZone,
  Page,
  RecordInput,
  Tag,
  User,
  Vpc,
  ZoneType,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function toQuery(params: Query): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      throw new ApiError(res.status, detail.code ?? "Error", detail.message ?? res.statusText);
    }
    // FastAPI request-validation errors come back as a list.
    if (Array.isArray(detail)) {
      const msg = detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join("; ");
      throw new ApiError(res.status, "InvalidInput", msg || "Invalid input");
    }
    throw new ApiError(res.status, "Error", typeof detail === "string" ? detail : res.statusText);
  }
  return data as T;
}

export interface ZoneListParams {
  q?: string;
  name?: string;
  type?: string;
  comment?: string;
  page?: number;
  page_size?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface RecordListParams {
  q?: string;
  type?: string;
  routing_policy?: string;
  alias?: string;
  page?: number;
  page_size?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

export const api = {
  login: (account: string, username: string, password: string) =>
    request<User>("POST", "/auth/login", { account, username, password }),
  logout: () => request<void>("POST", "/auth/logout"),
  me: () => request<User>("GET", "/auth/me"),

  dashboard: () => request<DashboardSummary>("GET", "/dashboard"),

  listZones: (params: ZoneListParams) => request<Page<HostedZone>>("GET", `/hostedzones${toQuery({ ...params })}`),
  getZone: (id: string) => request<HostedZone>("GET", `/hostedzones/${id}`),
  createZone: (body: { name: string; comment: string; type: ZoneType; vpcs: Vpc[]; tags: Tag[] }) =>
    request<HostedZone>("POST", "/hostedzones", body),
  updateZone: (id: string, body: { comment?: string; tags?: Tag[]; vpcs?: Vpc[] }) =>
    request<HostedZone>("PATCH", `/hostedzones/${id}`, body),
  deleteZone: (id: string) => request<void>("DELETE", `/hostedzones/${id}`),
  exportUrl: (id: string, format: "json" | "bind") => `/api/hostedzones/${id}/export${toQuery({ format })}`,
  importZoneFile: (id: string, zoneFile: string) =>
    request<ImportResult>("POST", `/hostedzones/${id}/import`, { zone_file: zoneFile }),

  listRecords: (zoneId: string, params: RecordListParams) =>
    request<Page<DnsRecord>>("GET", `/hostedzones/${zoneId}/records${toQuery({ ...params })}`),
  createRecords: (zoneId: string, records: RecordInput[]) =>
    request<{ items: DnsRecord[] }>("POST", `/hostedzones/${zoneId}/records`, { records }),
  updateRecord: (zoneId: string, recordId: number, record: RecordInput) =>
    request<DnsRecord>("PUT", `/hostedzones/${zoneId}/records/${recordId}`, record),
  deleteRecord: (zoneId: string, recordId: number) =>
    request<void>("DELETE", `/hostedzones/${zoneId}/records/${recordId}`),
  deleteRecords: (zoneId: string, ids: number[]) =>
    request<{ deleted: number }>("POST", `/hostedzones/${zoneId}/records/batch-delete`, { ids }),
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred.";
}
