import { useState, useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api, ApiError } from '@/lib/api';
import type { BlockAnalysisResponse, TxAnalysisResponse, Alert as ApiAlert } from '@/types/api';

// ── Primitives ─────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { bg: string; rowBg: string; badge: string }> = {
  critical:      { bg: 'rgba(239,68,68,0.12)',    rowBg: 'rgba(239,68,68,0.06)',    badge: 'bg-red-600 text-white' },
  warning:       { bg: 'rgba(245,158,11,0.10)',   rowBg: 'rgba(245,158,11,0.05)',   badge: 'bg-amber-500 text-black' },
  informational: { bg: 'rgba(59,130,246,0.10)',   rowBg: 'rgba(59,130,246,0.05)',   badge: 'bg-blue-500 text-white' },
};

const LN_TYPE_LABELS: Record<string, string> = {
  commitment:   'Commitment',
  htlc_timeout: 'HTLC Timeout',
  htlc_success: 'HTLC Success',
};

const truncTxid = (txid: string, n = 8) =>
  txid ? `${txid.slice(0, n)}…${txid.slice(-n)}` : '—';

function getMaxSeverity(alerts: ApiAlert[]) {
  if (alerts.length === 0) return null;
  if (alerts.some((a) => a.severity === 'critical')) return 'critical';
  if (alerts.some((a) => a.severity === 'warning')) return 'warning';
  return 'informational';
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1 rounded text-[11px] font-mono transition-colors"
      style={{
        background: active ? 'rgba(103,232,249,0.12)' : 'transparent',
        color: active ? '#67e8f9' : '#64748b',
        border: `1px solid ${active ? 'rgba(103,232,249,0.3)' : '#1e2028'}`,
      }}
    >
      {label}
    </button>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const c = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.informational;
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase ${c.badge}`}>
      {severity.toUpperCase()}
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface BlockExplorerProps {
  onTxClick?: (txid: string) => void;
}

export function BlockExplorer({ onTxClick }: BlockExplorerProps) {
  const [height, setHeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BlockAnalysisResponse | null>(null);
  const [filter, setFilter] = useState<'timelocks' | 'alerts' | 'all'>('timelocks');
  const [limit, setLimit] = useState('100');

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const heightNum = Number.parseInt(height, 10);
    const limitNum = Number.parseInt(limit, 10);
    if (!heightNum || heightNum < 0) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await api.getBlock(heightNum, { filter: 'all', offset: 0, limit: limitNum || 100 });
      setData(result);
    } catch (err) {
      let message: string;
      if (err instanceof ApiError) {
        message = err.message;
      } else if (err instanceof Error && err.name === 'AbortError') {
        message = 'Request timed out. Block scan can take 1–2 minutes. Try again or reduce the limit.';
      } else {
        message = err instanceof Error ? err.message : String(err);
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === 'alerts') return data.transactions.filter((t) => (t.alerts ?? []).length > 0);

    type FlexTl = TxAnalysisResponse['timelock'] & {
      summary?: { has_active_timelocks?: boolean };
      cltv_timelocks?: unknown[];
      csv_timelocks?: unknown[];
      inputs?: unknown[];
    };

    if (filter === 'timelocks') {
      return data.transactions.filter((t) => {
        const tl = t.timelock as FlexTl;
        const hasSummary = tl.summary?.has_active_timelocks;
        const hasCltv = (tl.cltv_timelocks?.length ?? 0) > 0;
        const hasCsv = (tl.csv_timelocks?.length ?? 0) > 0;
        const hasSeqs = (tl.sequences?.filter((s) => !s.is_final).length ?? 0) > 0 || (tl.inputs?.length ?? 0) > 0;
        return hasSummary || hasCltv || hasCsv || hasSeqs;
      });
    }
    return data.transactions;
  }, [data, filter]);

  return (
    <div className="space-y-4">
      {/* Scan form */}
      <form onSubmit={handleScan} className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <label htmlFor="block-height" className="font-mono text-[11px] text-muted-foreground">Block height</label>
          <input
            id="block-height"
            data-testid="block-height"
            type="number"
            placeholder="e.g. 938587"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            disabled={loading}
            className="w-40 bg-card border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="block-limit" className="font-mono text-[11px] text-muted-foreground">Max rows</label>
          <input
            id="block-limit"
            data-testid="block-limit"
            type="number"
            placeholder="100"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            disabled={loading}
            className="w-20 bg-card border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <button
          data-testid="scan-block-btn"
          type="submit"
          disabled={loading || !height}
          className="px-4 py-1.5 rounded bg-primary text-background font-mono text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Scanning… (1–2 min)' : 'Scan'}
        </button>
        {!loading && !data && (
          <p className="font-mono text-[11px] text-muted-foreground/50 self-end pb-1.5">
            First scan can take 30–60 s. Run with{' '}
            <code className="bg-card/80 px-1 rounded">--request-delay-ms 0</code> for faster results.
          </p>
        )}
      </form>

      {error && (
        <Alert variant="destructive" data-testid="block-error">
          <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {data && (
        <div className="space-y-3">
          {/* Block meta + filter chips */}
          <div className="flex items-center gap-4 flex-wrap">
            <a
              href={`https://mempool.space/block-height/${data.height}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono font-semibold text-sm text-primary hover:underline"
              data-testid="block-total"
            >
              Block {data.height.toLocaleString()} ↗
            </a>
            <span className="font-mono text-xs text-muted-foreground">
              {data.total_transactions.toLocaleString()} txs total · {filtered.length} shown
            </span>
            <div className="flex gap-1.5 ml-auto">
              <FilterChip label="With Timelocks" active={filter === 'timelocks'} onClick={() => setFilter('timelocks')} />
              <FilterChip label="With Alerts"    active={filter === 'alerts'}    onClick={() => setFilter('alerts')} />
              <FilterChip label="All"            active={filter === 'all'}       onClick={() => setFilter('all')} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center py-10 font-mono text-xs text-muted-foreground/50">
              No transactions match the selected filter.
            </p>
          ) : (
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-border">
                    {['Transaction', 'Lightning', 'nLockTime', 'nSeq', 'CLTV', 'CSV', 'Alerts'].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-widest text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx: TxAnalysisResponse) => {
                    type FlexTl = typeof tx.timelock & {
                      inputs?: unknown[];
                      cltv_timelocks?: unknown[];
                      csv_timelocks?: unknown[];
                      summary?: {
                        nlocktime_active?: boolean;
                        relative_timelock_count?: number;
                        cltv_count?: number;
                        csv_count?: number;
                      };
                    };
                    const tl = tx.timelock as FlexTl;
                    const alerts = tx.alerts ?? [];
                    const maxSev = getMaxSeverity(alerts);
                    const rowBg = maxSev ? SEVERITY_CONFIG[maxSev].rowBg : 'transparent';

                    const nlocktimeActive =
                      tl.summary?.nlocktime_active ??
                      (('is_enforced' in tl.nlocktime ? (tl.nlocktime as { is_enforced?: boolean }).is_enforced : null) ??
                       ('active' in tl.nlocktime ? (tl.nlocktime as { active?: boolean }).active : false));

                    const seqCount = tl.summary?.relative_timelock_count ??
                      (tl.sequences?.filter((s) => !s.is_final).length ?? 0);
                    const cltvCount = tl.summary?.cltv_count ??
                      (tl.cltv_timelocks?.length ?? tl.script_timelocks?.filter((s) => s.opcode === 'OP_CHECKLOCKTIMEVERIFY').length ?? 0);
                    const csvCount = tl.summary?.csv_count ??
                      (tl.csv_timelocks?.length ?? tl.script_timelocks?.filter((s) => s.opcode === 'OP_CHECKSEQUENCEVERIFY').length ?? 0);

                    return (
                      <tr
                        key={tx.timelock.txid}
                        data-testid="tx-row"
                        style={{ background: rowBg }}
                        className="border-b border-[#0d0f13] cursor-pointer transition-colors hover:bg-[#161922]"
                        onClick={() => onTxClick?.(tx.timelock.txid)}
                      >
                        {/* Transaction */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-primary hover:underline">
                              {truncTxid(tx.timelock.txid)}
                            </span>
                            <a
                              href={`https://mempool.space/tx/${tx.timelock.txid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground text-[11px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              ↗
                            </a>
                          </div>
                        </td>

                        {/* Lightning */}
                        <td className="px-3 py-2.5">
                          {tx.lightning?.tx_type ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] bg-yellow-400/10 text-yellow-300 border border-yellow-500/20">
                              {LN_TYPE_LABELS[tx.lightning.tx_type] ?? tx.lightning.tx_type}
                              <span
                                className="w-1.5 h-1.5 rounded-full inline-block"
                                style={{ background: tx.lightning.confidence === 'highly_likely' ? '#22c55e' : tx.lightning.confidence === 'possible' ? '#f59e0b' : '#6b7280' }}
                              />
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>

                        {/* nLockTime */}
                        <td className="px-3 py-2.5">
                          <span style={{ color: nlocktimeActive ? '#e2e8f0' : '#374151' }}>
                            {tl.nlocktime?.human_readable ?? '—'}
                          </span>
                        </td>

                        {/* nSeq */}
                        <td className="px-3 py-2.5">
                          <span style={{ color: seqCount > 0 ? '#fbbf24' : '#374151' }}>
                            {seqCount > 0 ? `${seqCount} active` : '—'}
                          </span>
                        </td>

                        {/* CLTV */}
                        <td className="px-3 py-2.5">
                          <span style={{ color: cltvCount > 0 ? '#f87171' : '#374151' }}>
                            {cltvCount > 0 ? cltvCount : '—'}
                          </span>
                        </td>

                        {/* CSV */}
                        <td className="px-3 py-2.5">
                          <span style={{ color: csvCount > 0 ? '#a78bfa' : '#374151' }}>
                            {csvCount > 0 ? csvCount : '—'}
                          </span>
                        </td>

                        {/* Alerts */}
                        <td className="px-3 py-2.5">
                          {alerts.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
                              {alerts.map((a, i) => (
                                <SeverityBadge key={i} severity={a.severity} />
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#22c55e]">clear</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
