// Fetch helpers and types matching the FastAPI backend. One small function per endpoint.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Decision = "renter_liable" | "operator_liable" | "needs_review" | "no_vehicle";
export type ViolationStatus = "open" | "charged_renter" | "paid_by_operator" | "dismissed";
export type ResolveAction = "charge_renter" | "operator_pays" | "dismiss";

export type Sample = { label: string; text: string };

export type ParsedNotice = {
  plate: string | null;
  violation: string | null;
  occurred_local: string | null; // "YYYY-MM-DDTHH:MM:SS", operator's local time
  location: string;
  amount: number | null;
  notice_date: string | null;
  respond_by: string | null;
  missing: string[];
};

// What the operator confirms in the form and sends to POST /violations.
export type ViolationInput = {
  plate: string;
  violation: string;
  occurred_local: string;
  location: string;
  amount: number;
  notice_date: string;
  respond_by: string;
  raw_text: string | null;
};

export type Violation = {
  id: string;
  vehicle_id: string | null;
  plate: string;
  violation: string;
  occurred_at: string; // UTC ISO timestamp
  location: string;
  amount: number;
  notice_date: string;
  respond_by: string;
  raw_text: string | null;
  decision: Decision;
  reason: string;
  booking_id: string | null;
  late_return: boolean;
  status: ViolationStatus;
  created_at: string;
  days_left: number;
  charge_total: number | null;
  message_draft: string | null;
  renter_name: string | null;
  vehicle_name: string | null;
};

export type Booking = {
  id: string;
  vehicle_id: string;
  renter_name: string;
  start_at: string;
  end_at: string; // scheduled return
  actual_return_at: string | null;
  status: "upcoming" | "active" | "completed" | "cancelled";
};

export type Vehicle = { id: string; name: string; plate: string; bookings: Booking[] };

export class ApiError extends Error {
  constructor(message: string, public status: number, public detail: unknown) {
    super(message);
  }
}

// The API sends `detail` as a plain string, or as an object with a `message`.
function errorMessage(detail: unknown, status: number): string {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail) return String(detail.message);
  return `Request failed (${status}).`;
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(`Cannot reach the API at ${API_URL}. Is the backend running?`, 0, null);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    throw new ApiError(errorMessage(detail, response.status), response.status, detail);
  }
  return data as T;
}

export const getSamples = () => request<Sample[]>("/samples");

// A 422 with partial fields is not a failure for the UI: the operator fills in the gaps.
export async function parseNotice(text: string): Promise<{ parsed: ParsedNotice; message: string | null }> {
  try {
    return { parsed: await request<ParsedNotice>("/notices/parse", { text }), message: null };
  } catch (error) {
    const detail = error instanceof ApiError ? (error.detail as { parsed?: ParsedNotice } | null) : null;
    if (detail?.parsed) return { parsed: detail.parsed, message: (error as ApiError).message };
    throw error;
  }
}

export const createViolation = (input: ViolationInput) => request<Violation>("/violations", input);
export const listViolations = () => request<Violation[]>("/violations");
export const resolveViolation = (id: string, action: ResolveAction) =>
  request<Violation>(`/violations/${id}/resolve`, { action });
export const listVehicles = () => request<Vehicle[]>("/vehicles");
export const resetDemo = () => request<{ vehicles: number; bookings: number }>("/demo/reset", {});
