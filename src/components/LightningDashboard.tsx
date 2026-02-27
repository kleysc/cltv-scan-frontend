import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api, ApiError } from '@/lib/api';
import type { LightningResponse, LightningTransaction } from '@/types/api';

const LN_TYPE_LABELS: Record<string, string> = {
  commitment:   'Commitment (Force-Close)',
  htlc_timeout: 'HTLC Timeout',
  htlc_success: 'HTLC Success',
};

const truncTxid = (txid: string, n = 8) =>
  txid ? `${txid.slice(0, n)}…${txid.slice(-n)}` : '—';

// ── Mini bar chart (no recharts dependency for this) ──────────────────────────

function MiniBarChart({ data }: { data: { block_height: number; count: number }[] }) {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  // Highlight clustering if many HTLCs expire in a short range
  const maxCount = Math.max(...data.map((d) => d.count));
  const clusterThreshold = maxCount * 0.6;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, padding: '0 4px' }}>
      {data.map((d) => {
        const h = Math.max((d.count / maxVal) * 120, 3);
        const isHot = d.count >= clusterThreshold && maxCount > 3;
        return (
          <div
            key={d.block_height}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}
            title={`Block ${d.block_height}: ${d.count} HTLCs`}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 28,
                minWidth: 6,
                height: h,
                background: isHot ? 'rgba(239,68,68,0.7)' : 'rgba(103,232,249,0.35)',
                borderRadius: '2px 2px 0 0',
                border: `1px solid ${isHot ? '#ef4444' : 'rgba(103,232,249,0.2)'}`,
              }}
            />
            <span
              className="font-mono"
              style={{ fontSize: '0.5rem', color: '#475569', marginTop: 3, transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}
            >
              {d.block_height}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface LightningDashboardProps {
  onTxClick?: (txid: string) => void;
}

export function LightningDashboard({ onTxClick }: LightningDashboardProps) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LightningResponse | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const startNum = Number.parseInt(start, 10);
    const endNum = end ? Number.parseInt(end, 10) : undefined;
    if (!startNum || startNum < 0) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await api.lightning({ start: startNum, end: endNum });
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Form */}
      <form onSubmit={handleAnalyze} className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <label htmlFor="ln-start" className="font-mono text-[11px] text-muted-foreground">Start height</label>
          <input
            id="ln-start"
            data-testid="ln-start"
            type="number"
            placeholder="e.g. 938000"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            disabled={loading}
            className="w-40 bg-card border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="ln-end" className="font-mono text-[11px] text-muted-foreground">
            End height <span className="text-muted-foreground/40">(opt.)</span>
          </label>
          <input
            id="ln-end"
            data-testid="ln-end"
            type="number"
            placeholder="e.g. 938010"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            disabled={loading}
            className="w-40 bg-card border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <button
          data-testid="ln-btn"
          type="submit"
          disabled={loading || !start}
          className="px-4 py-1.5 rounded bg-primary text-background font-mono text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Analyzing… (1–2 min)' : 'Analyze'}
        </button>
      </form>

      {error && (
        <Alert variant="destructive" data-testid="ln-error">
          <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {data && (
        <div className="space-y-5">
          {/* Breadcrumb */}
          <p className="font-mono text-xs text-muted-foreground">
            Blocks {data.start_height.toLocaleString()}–{data.end_height.toLocaleString()} · {data.total_transactions_scanned.toLocaleString()} txs scanned
          </p>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Force-Closes',  value: data.commitments,              color: '#fbbf24', border: 'rgba(250,204,21,0.2)', sub: 'commitment txs', testId: 'ln-commitments' },
              { label: 'HTLC Timeouts', value: data.htlc_timeouts,            color: '#f87171', border: 'rgba(239,68,68,0.2)',  sub: 'refund path',    testId: 'ln-htlc-timeouts' },
              { label: 'HTLC Success',  value: data.htlc_successes,           color: '#22c55e', border: 'rgba(34,197,94,0.2)',  sub: 'preimage revealed', testId: 'ln-htlc-successes' },
              { label: 'Total LN Txs',  value: data.commitments + data.htlc_timeouts + data.htlc_successes, color: '#67e8f9', border: 'rgba(103,232,249,0.2)', sub: `of ${data.total_transactions_scanned.toLocaleString()}`, testId: 'ln-total-scanned' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded bg-card p-4 text-center"
                style={{ border: `1px solid ${stat.border}` }}
              >
                <div
                  data-testid={stat.testId}
                  className="text-2xl font-bold font-mono tabular-nums"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                  {stat.label}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">
                  {stat.sub}
                </div>
              </div>
            ))}
          </div>

          {/* HTLC Expiry Timeline */}
          {data.cltv_expiry_distribution.length > 0 && (
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3 pb-1.5 border-b border-border">
                HTLC Expiry Timeline
              </h3>
              <div className="rounded border border-border bg-card p-4">
                <div className="flex gap-4 text-[11px] font-mono mb-4">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 inline-block rounded-sm" style={{ background: 'rgba(103,232,249,0.35)', border: '1px solid rgba(103,232,249,0.2)' }} />
                    <span className="text-muted-foreground">Normal</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 inline-block rounded-sm" style={{ background: 'rgba(239,68,68,0.7)', border: '1px solid #ef4444' }} />
                    <span className="text-muted-foreground">Cluster (potential flood-loot)</span>
                  </span>
                </div>
                <div data-testid="expiry-chart">
                  <MiniBarChart data={data.cltv_expiry_distribution} />
                </div>
              </div>
            </div>
          )}

          {/* Lightning tx list */}
          {data.transactions.length > 0 && (
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3 pb-1.5 border-b border-border">
                Lightning Transactions ({data.transactions.length})
              </h3>
              <div className="space-y-1">
                {data.transactions.map((entry: LightningTransaction) => (
                  <div
                    key={entry.txid}
                    data-testid="ln-tx-row"
                    className="rounded border border-border bg-card px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-[#161922] transition-colors"
                    onClick={() => onTxClick?.(entry.txid)}
                  >
                    <span className="font-mono text-xs text-primary truncate flex-1">
                      {truncTxid(entry.txid)}
                    </span>
                    <a
                      href={`https://mempool.space/tx/${entry.txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground text-[11px] font-mono"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ↗
                    </a>
                    {entry.classification.tx_type && (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm bg-yellow-400/10 text-yellow-300 border border-yellow-500/20 shrink-0">
                        {LN_TYPE_LABELS[entry.classification.tx_type] ?? entry.classification.tx_type}
                      </span>
                    )}
                    <span
                      className="font-mono text-[11px] shrink-0"
                      style={{
                        color: entry.classification.confidence === 'highly_likely' ? '#22c55e'
                          : entry.classification.confidence === 'possible' ? '#f59e0b'
                          : '#6b7280',
                      }}
                    >
                      {entry.classification.confidence.replaceAll('_', ' ')}
                    </span>
                    {entry.classification.params?.cltv_expiry != null && (
                      <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                        CLTV: {entry.classification.params.cltv_expiry.toLocaleString()}
                      </span>
                    )}
                    {entry.classification.params?.preimage_revealed && (
                      <span className="font-mono text-[11px] text-green-400 shrink-0">preimage ✓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.transactions.length === 0 && (
            <p className="text-center py-8 font-mono text-xs text-muted-foreground/50">
              No Lightning transactions found in this range.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
