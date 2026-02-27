// API client for cltv-scan backend

import type {
  TxAnalysisResponse,
  BlockAnalysisResponse,
  ScanResponse,
  LightningResponse,
} from '@/types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiError(
      `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      text
    );
  }

  const data = await response.json();
  return data as T;
}

export const api = {
  /**
   * GET /api/tx/:txid
   * Analyze a single transaction by txid
   */
  async getTransaction(txid: string): Promise<TxAnalysisResponse> {
    return fetchJson<TxAnalysisResponse>(`${API_BASE_URL}/api/tx/${txid}`);
  },

  /**
   * GET /api/block/:height?filter=timelocks|alerts|all&offset=N&limit=N
   * Analyze all transactions in a block
   */
  async getBlock(
    height: number,
    options?: {
      filter?: 'timelocks' | 'alerts' | 'all';
      offset?: number;
      limit?: number;
    }
  ): Promise<BlockAnalysisResponse> {
    const params = new URLSearchParams();
    if (options?.filter) params.set('filter', options.filter);
    if (options?.offset !== undefined) params.set('offset', String(options.offset));
    if (options?.limit !== undefined) params.set('limit', String(options.limit));

    const query = params.toString();
    const url = `${API_BASE_URL}/api/block/${height}${query ? `?${query}` : ''}`;

    return fetchJson<BlockAnalysisResponse>(url);
  },

  /**
   * GET /api/scan?start=N&end=N&severity=critical|warning|informational
   *                    &detection_type=timelock_mixing|short_cltv_delta|
   *                                    htlc_clustering|anomalous_sequence
   * Scan block range for security alerts
   */
  async scan(options: {
    start: number;
    end?: number;
    severity?: 'critical' | 'warning' | 'informational';
    detection_type?: 'timelock_mixing' | 'short_cltv_delta' | 'htlc_clustering' | 'anomalous_sequence';
  }): Promise<ScanResponse> {
    const params = new URLSearchParams();
    params.set('start', String(options.start));
    if (options.end !== undefined) params.set('end', String(options.end));
    if (options.severity) params.set('severity', options.severity);
    if (options.detection_type) params.set('detection_type', options.detection_type);

    const url = `${API_BASE_URL}/api/scan?${params.toString()}`;
    return fetchJson<ScanResponse>(url);
  },

  /**
   * GET /api/lightning?start=N&end=N
   * Analyze Lightning Network transactions in block range
   */
  async lightning(options: {
    start: number;
    end?: number;
  }): Promise<LightningResponse> {
    const params = new URLSearchParams();
    params.set('start', String(options.start));
    if (options.end !== undefined) params.set('end', String(options.end));

    const url = `${API_BASE_URL}/api/lightning?${params.toString()}`;
    return fetchJson<LightningResponse>(url);
  },

  /**
   * Create an EventSource for mempool monitoring
   * GET /api/monitor?interval=N&min_severity=info|warning|critical
   */
  createMonitorStream(options?: {
    interval?: number;
    min_severity?: 'info' | 'warning' | 'critical';
  }): EventSource {
    const params = new URLSearchParams();
    if (options?.interval !== undefined) params.set('interval', String(options.interval));
    if (options?.min_severity) params.set('min_severity', options.min_severity);

    const query = params.toString();
    const url = `${API_BASE_URL}/api/monitor${query ? `?${query}` : ''}`;

    return new EventSource(url);
  },
};

export { ApiError };
