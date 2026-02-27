/**
 * cltv-scan API client — same endpoints as frontend_ref.
 * Base URL: VITE_API_URL or http://localhost:3001
 */
import type {
  TxAnalysisResponse,
  BlockAnalysisResponse,
  ScanResponse,
  LightningResponse,
} from "@/types/api";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** GET /api/tx/:txid — full timelock + Lightning + security analysis for one transaction */
export function getTx(txid: string): Promise<TxAnalysisResponse> {
  return get(`/api/tx/${txid.trim()}`);
}

export interface BlockParams {
  filter?: "timelocks" | "alerts" | "all";
  offset?: number;
  limit?: number;
}

/** GET /api/block/:height?filter=&offset=&limit= — analyzed transactions in a block */
export function getBlock(
  height: number,
  params: BlockParams = {}
): Promise<BlockAnalysisResponse> {
  const q = new URLSearchParams();
  if (params.filter) q.set("filter", params.filter);
  if (params.offset != null) q.set("offset", String(params.offset));
  if (params.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString() ? `?${q}` : "";
  return get(`/api/block/${height}${qs}`);
}

export interface ScanParams {
  start: number;
  end?: number;
  severity?: "critical" | "warning" | "informational";
  detection_type?:
    | "timelock_mixing"
    | "short_cltv_delta"
    | "htlc_clustering"
    | "anomalous_sequence";
}

/** GET /api/scan?start=&end=&severity=&detection_type= — security alerts in a block range */
export function getScan(params: ScanParams): Promise<ScanResponse> {
  const q = new URLSearchParams({ start: String(params.start) });
  if (params.end != null) q.set("end", String(params.end));
  if (params.severity) q.set("severity", params.severity);
  if (params.detection_type) q.set("detection_type", params.detection_type);
  return get(`/api/scan?${q}`);
}

export interface LightningParams {
  start: number;
  end?: number;
}

/** GET /api/lightning?start=&end= — Lightning activity summary in a block range */
export function getLightning(
  params: LightningParams
): Promise<LightningResponse> {
  const q = new URLSearchParams({ start: String(params.start) });
  if (params.end != null) q.set("end", String(params.end));
  return get(`/api/lightning?${q}`);
}

export interface MonitorParams {
  interval?: number;
  min_severity?: "info" | "warning" | "critical";
}

/**
 * GET /api/monitor (SSE) — real-time mempool stream.
 * Server emits "tx" events with { txid, timelock, lightning, alerts }.
 * Caller must call .close() on the returned EventSource when done.
 */
export function createMonitor(params: MonitorParams = {}): EventSource {
  const q = new URLSearchParams();
  if (params.interval != null) q.set("interval", String(params.interval));
  if (params.min_severity) q.set("min_severity", params.min_severity);
  const qs = q.toString() ? `?${q}` : "";
  return new EventSource(`${BASE}/api/monitor${qs}`);
}
