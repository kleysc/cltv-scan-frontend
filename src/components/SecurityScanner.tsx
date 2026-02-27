import { useState, useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api, ApiError } from '@/lib/api';
import type { ScanResponse, Alert as ApiAlert } from '@/types/api';

const SEVERITY_CONFIG: Record<string, { bg: string; border: string; leftBorder: string; text: string; badge: string }> = {
  critical:      { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   leftBorder: '#ef4444', text: '#fca5a5', badge: 'bg-red-600 text-white' },
  warning:       { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  leftBorder: '#f59e0b', text: '#fcd34d', badge: 'bg-amber-500 text-black' },
  informational: { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)',  leftBorder: '#3b82f6', text: '#93c5fd', badge: 'bg-blue-500 text-white' },
};

const DETECTION_LABELS: Record<string, string> = {
  timelock_mixing:   'Timelock Mixing',
  short_cltv_delta:  'Short CLTV Delta',
  htlc_clustering:   'HTLC Clustering',
  anomalous_sequence:'Anomalous Sequence',
};

const truncTxid = (txid: string, n = 8) =>
  txid ? `${txid.slice(0, n)}…${txid.slice(-n)}` : '';

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-0.5 rounded text-[11px] font-mono transition-colors"
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

function AlertCard({ alert, onTxClick }: { alert: ApiAlert; onTxClick?: (txid: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const c = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.informational;

  return (
    <div
      data-testid="alert-item"
      className="rounded cursor-pointer transition-all"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${c.leftBorder}`,
        padding: '12px 16px',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wider ${c.badge}`}>
          {alert.severity.toUpperCase()}
        </span>
        <span className="inline-block px-2 py-0.5 rounded-sm text-[10px] font-mono bg-violet-950/50 text-violet-300 border border-violet-800/40">
          {DETECTION_LABELS[alert.detection_type] ?? alert.detection_type}
        </span>
        {alert.txid && (
          <button
            type="button"
            className="font-mono text-[11px] text-primary hover:underline"
            onClick={(e) => { e.stopPropagation(); onTxClick?.(alert.txid); }}
          >
            {truncTxid(alert.txid)}
          </button>
        )}
        {alert.input_index != null && (
          <span className="font-mono text-[11px] text-muted-foreground">input[{alert.input_index}]</span>
        )}
      </div>

      <p className="text-sm leading-relaxed" style={{ color: c.text }}>{alert.description}</p>

      {alert.details.type === 'htlc_clustering' && (
        <div data-testid="clustering-detail" className="mt-2 px-2.5 py-2 rounded bg-background/40 font-mono text-[11px] text-muted-foreground space-y-0.5">
          <p>Window: block {alert.details.window_start} — {alert.details.window_end}</p>
          <p>Count: {alert.details.count} (threshold: {alert.details.threshold})</p>
        </div>
      )}

      {alert.details.type === 'short_cltv_delta' && (
        <div data-testid="cltv-detail" className="mt-2 px-2.5 py-2 rounded bg-background/40 font-mono text-[11px] text-muted-foreground space-y-0.5">
          <p>CLTV expiry: {alert.details.cltv_expiry}</p>
          <p>Current height: {alert.details.current_height}</p>
          <p>Blocks remaining: {alert.details.blocks_remaining}</p>
        </div>
      )}

      {expanded && alert.reference && (
        <div className="mt-3 pt-3 font-mono text-[11px] text-muted-foreground" style={{ borderTop: `1px solid ${c.border}` }}>
          <strong className="text-foreground/70">{alert.reference.name}</strong> — {alert.reference.year}
          {alert.reference.url && (
            <a
              href={alert.reference.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary ml-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              paper ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface SecurityScannerProps {
  onTxClick?: (txid: string) => void;
}

export function SecurityScanner({ onTxClick }: SecurityScannerProps) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScanResponse | null>(null);

  // Post-scan filters (applied client-side to the results)
  const [severityFilter, setSeverityFilter] = useState('all');
  const [detectionFilter, setDetectionFilter] = useState('all');

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const startNum = Number.parseInt(start, 10);
    const endNum = end ? Number.parseInt(end, 10) : undefined;
    if (!startNum || startNum < 0) return;

    setLoading(true);
    setError(null);
    setData(null);
    setSeverityFilter('all');
    setDetectionFilter('all');

    try {
      const result = await api.scan({ start: startNum, end: endNum });
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    let result = data.alerts;
    if (severityFilter !== 'all') result = result.filter((a) => a.severity === severityFilter);
    if (detectionFilter !== 'all') result = result.filter((a) => a.detection_type === detectionFilter);
    return result;
  }, [data, severityFilter, detectionFilter]);

  const counts = useMemo(() => ({
    critical:      data?.alerts.filter((a) => a.severity === 'critical').length ?? 0,
    warning:       data?.alerts.filter((a) => a.severity === 'warning').length ?? 0,
    informational: data?.alerts.filter((a) => a.severity === 'informational').length ?? 0,
  }), [data]);

  return (
    <div className="space-y-4">
      {/* Scan form */}
      <form onSubmit={handleScan} className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <label htmlFor="scan-start" className="font-mono text-[11px] text-muted-foreground">Start height</label>
          <input
            id="scan-start"
            data-testid="scan-start"
            type="number"
            placeholder="e.g. 938000"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            disabled={loading}
            className="w-40 bg-card border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="scan-end" className="font-mono text-[11px] text-muted-foreground">
            End height <span className="text-muted-foreground/40">(opt.)</span>
          </label>
          <input
            id="scan-end"
            data-testid="scan-end"
            type="number"
            placeholder="e.g. 938010"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            disabled={loading}
            className="w-40 bg-card border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <button
          data-testid="scan-btn"
          type="submit"
          disabled={loading || !start}
          className="px-4 py-1.5 rounded bg-primary text-background font-mono text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Scanning… (1–2 min)' : 'Scan'}
        </button>
      </form>

      {error && (
        <Alert variant="destructive" data-testid="scan-error">
          <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {data && (
        <div className="space-y-4">
          {/* Meta */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">
              BLOCKS {data.start_height}–{data.end_height}
            </span>
            <span className="font-mono text-xs text-muted-foreground/40">|</span>
            <span className="font-mono text-xs text-muted-foreground" data-testid="scan-current-tip">
              TIP {data.current_tip}
            </span>
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Alerts', value: data.total_alerts,    color: '#e2e8f0', border: '#1e2028', testId: 'scan-total' },
              { label: 'Critical',     value: counts.critical,      color: '#ef4444', border: 'rgba(239,68,68,0.3)', testId: 'scan-critical-count' },
              { label: 'Warning',      value: counts.warning,       color: '#f59e0b', border: 'rgba(245,158,11,0.3)', testId: 'scan-warning-count' },
              { label: 'Info',         value: counts.informational, color: '#3b82f6', border: 'rgba(59,130,246,0.3)', testId: 'scan-info-count' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded bg-card p-3 text-center"
                style={{ border: `1px solid ${stat.border}` }}
              >
                <div
                  data-testid={stat.testId}
                  className="font-mono font-bold text-2xl tabular-nums"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Result filters */}
          {data.alerts.length > 0 && (
            <div className="space-y-2">
              <div className="flex gap-2 flex-wrap items-center">
                <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">Severity:</span>
                {['all', 'critical', 'warning', 'informational'].map((s) => (
                  <FilterChip
                    key={s}
                    label={s === 'all' ? 'ALL' : s.toUpperCase()}
                    active={severityFilter === s}
                    onClick={() => setSeverityFilter(s)}
                  />
                ))}
                <span className="w-4" />
                <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">Type:</span>
                {['all', ...Object.keys(DETECTION_LABELS)].map((d) => (
                  <FilterChip
                    key={d}
                    label={d === 'all' ? 'ALL' : DETECTION_LABELS[d]}
                    active={detectionFilter === d}
                    onClick={() => setDetectionFilter(d)}
                  />
                ))}
              </div>

              <div className="space-y-2">
                {filtered.length === 0 ? (
                  <p className="text-center py-8 font-mono text-xs text-muted-foreground/50">
                    No alerts match the selected filters.
                  </p>
                ) : (
                  filtered.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} onTxClick={onTxClick} />
                  ))
                )}
              </div>
            </div>
          )}

          {data.total_alerts === 0 && (
            <p className="text-center py-8 font-mono text-xs text-muted-foreground/50">
              No alerts found in blocks {data.start_height}–{data.end_height}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
