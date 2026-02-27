import { useState, useEffect, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api, ApiError } from '@/lib/api';
import type { TxAnalysisResponse, Alert as ApiAlert } from '@/types/api';

// ── Shared primitives ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  critical:      { bg: 'bg-red-950/40',    border: 'border-l-red-500 border-red-500/20',    text: 'text-red-300',    badge: 'bg-red-600 text-white' },
  warning:       { bg: 'bg-amber-950/30',  border: 'border-l-amber-500 border-amber-500/20', text: 'text-amber-300',  badge: 'bg-amber-500 text-black' },
  informational: { bg: 'bg-blue-950/30',   border: 'border-l-blue-500 border-blue-500/20',  text: 'text-blue-300',   badge: 'bg-blue-500 text-white' },
};

const DETECTION_LABELS: Record<string, string> = {
  timelock_mixing: 'Timelock Mixing',
  short_cltv_delta: 'Short CLTV Delta',
  htlc_clustering: 'HTLC Clustering',
  anomalous_sequence: 'Anomalous Sequence',
};

const LN_TYPE_LABELS: Record<string, string> = {
  commitment:   'Commitment (Force-Close)',
  htlc_timeout: 'HTLC Timeout',
  htlc_success: 'HTLC Success',
};

const truncTxid = (txid: string, n = 8) =>
  txid ? `${txid.slice(0, n)}…${txid.slice(-n)}` : '—';

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-5 mb-2 pb-1.5 border-b border-border">
      {children}
    </h3>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="font-mono text-xs text-muted-foreground min-w-[130px] shrink-0">{label}</span>
      <span className="text-foreground flex-1">{children}</span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const c = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.informational;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold font-mono uppercase tracking-wider ${c.badge}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function DetectionBadge({ type: dt }: { type: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-sm text-[10px] font-mono bg-violet-950/50 text-violet-300 border border-violet-800/40">
      {DETECTION_LABELS[dt] ?? dt}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface TxAnalyzerProps {
  initialTxid?: string;
}

export function TxAnalyzer({ initialTxid }: TxAnalyzerProps) {
  const [inputTxid, setInputTxid] = useState(initialTxid ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TxAnalysisResponse | null>(null);
  const prevInitialRef = useRef<string | undefined>();

  const analyze = async (txid: string) => {
    if (!txid.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await api.getTransaction(txid.trim());
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialTxid && initialTxid !== prevInitialRef.current) {
      prevInitialRef.current = initialTxid;
      setInputTxid(initialTxid);
      analyze(initialTxid);
    }
  }, [initialTxid]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    analyze(inputTxid);
  };

  // Normalise API field names (backend may use inputs/cltv_timelocks/csv_timelocks)
  type FlexTl = TxAnalysisResponse['timelock'] & {
    inputs?: Array<{ input_index: number; raw_hex: string; meaning: string; relative_timelock?: { domain: string; value: number; human_readable: string } | null }>;
    cltv_timelocks?: Array<{ input_index: number; script_field: string; opcode?: string; raw_value: number; domain: string; human_readable: string }>;
    csv_timelocks?: Array<{ input_index: number; script_field: string; opcode?: string; raw_value: number; domain: string; human_readable: string }>;
    summary?: {
      has_active_timelocks?: boolean;
      nlocktime_active?: boolean;
      relative_timelock_count?: number;
      cltv_count?: number;
      csv_count?: number;
    };
  };

  const tl: FlexTl | undefined = data?.timelock as FlexTl | undefined;
  const ln = data?.lightning;
  const alerts = data?.alerts ?? [];

  const inputs = tl?.inputs ?? tl?.sequences?.map((s) => ({
    input_index: s.input_index,
    raw_hex: s.raw_hex,
    meaning: s.is_final ? 'final' : s.rbf_signaling ? 'rbf_enabled' : 'relative_timelock',
    relative_timelock: s.relative_timelock != null
      ? { domain: 'block_height', value: s.relative_timelock, human_readable: `${s.relative_timelock} blocks` }
      : null,
  })) ?? [];

  const cltvTimelocks = tl?.cltv_timelocks ??
    tl?.script_timelocks?.filter((st) => st.opcode === 'OP_CHECKLOCKTIMEVERIFY').map((st) => ({
      input_index: 0,
      script_field: st.field,
      raw_value: st.threshold_value,
      domain: st.domain,
      human_readable: st.human_readable,
    })) ?? [];

  const csvTimelocks = tl?.csv_timelocks ??
    tl?.script_timelocks?.filter((st) => st.opcode === 'OP_CHECKSEQUENCEVERIFY').map((st) => ({
      input_index: 0,
      script_field: st.field,
      raw_value: st.threshold_value,
      domain: st.domain,
      human_readable: st.human_readable,
    })) ?? [];

  const nlocktime = tl?.nlocktime;
  const nlocktimeActive = nlocktime
    ? (('is_enforced' in nlocktime ? (nlocktime as { is_enforced?: boolean }).is_enforced : null) ??
       ('active' in nlocktime ? (nlocktime as { active?: boolean }).active : null) ??
       false)
    : false;

  const summary = tl?.summary;

  const hasCritical = alerts.some((a) => a.severity === 'critical');

  return (
    <div className="space-y-4">
      {/* Search */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          data-testid="txid-input"
          type="text"
          placeholder="Enter transaction ID (64 hex characters)"
          value={inputTxid}
          onChange={(e) => setInputTxid(e.target.value)}
          disabled={loading}
          className="flex-1 bg-card border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
        />
        <button
          data-testid="analyze-btn"
          type="submit"
          disabled={loading || !inputTxid.trim()}
          className="px-4 py-2 rounded bg-primary text-background font-mono text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
      </form>

      {error && (
        <Alert variant="destructive" data-testid="tx-error">
          <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {hasCritical && (
        <div className="rounded border border-red-500/40 bg-red-950/30 px-4 py-2.5" data-testid="critical-banner">
          <p className="text-red-300 font-mono text-xs font-semibold">
            Critical security alert detected in this transaction.
          </p>
        </div>
      )}

      {!data && !error && !loading && (
        <p className="text-center py-12 text-xs font-mono text-muted-foreground/50">
          Enter a transaction ID above and press Analyze — or click any txid in Block or Lightning views.
        </p>
      )}

      {data && tl && (
        <div>
          {/* Txid + external link */}
          <div className="flex items-center gap-3 mb-4">
            <span
              data-testid="tx-txid"
              className="font-mono text-xs text-foreground/70 break-all"
            >
              {tl.txid}
            </span>
            <a
              href={`https://mempool.space/tx/${tl.txid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary text-xs font-mono whitespace-nowrap hover:underline shrink-0"
            >
              mempool.space ↗
            </a>
          </div>

          {/* Lightning card */}
          {ln?.tx_type && (
            <div className="rounded border border-yellow-500/20 bg-yellow-950/10 p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-yellow-400/10 text-yellow-300 border border-yellow-500/20">
                  {LN_TYPE_LABELS[ln.tx_type] ?? ln.tx_type}
                </span>
                <span
                  data-testid="ln-confidence"
                  className="font-mono text-xs"
                  style={{ color: ln.confidence === 'highly_likely' ? '#22c55e' : ln.confidence === 'possible' ? '#f59e0b' : '#6b7280' }}
                >
                  {ln.confidence.replaceAll('_', ' ')}
                </span>
                <span
                  className="w-2 h-2 rounded-full inline-block ml-auto"
                  style={{ background: ln.confidence === 'highly_likely' ? '#22c55e' : ln.confidence === 'possible' ? '#f59e0b' : '#374151' }}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-0 divide-y divide-border/50">
                {ln.params.commitment_number != null && (
                  <DetailRow label="commit #"><span className="font-mono" data-testid="ln-type">{ln.params.commitment_number}</span></DetailRow>
                )}
                {ln.params.htlc_output_count != null && ln.params.htlc_output_count > 0 && (
                  <DetailRow label="HTLC outputs"><span className="font-mono">{ln.params.htlc_output_count}</span></DetailRow>
                )}
                {ln.params.cltv_expiry != null && (
                  <DetailRow label="CLTV expiry"><span className="font-mono">block {ln.params.cltv_expiry.toLocaleString()}</span></DetailRow>
                )}
                {ln.params.csv_delays?.length > 0 && (
                  <DetailRow label="CSV delays"><span className="font-mono">{ln.params.csv_delays.join(', ')} blocks</span></DetailRow>
                )}
                {ln.params.preimage_revealed && (
                  <DetailRow label="preimage">
                    <span className="font-mono text-green-400 break-all text-[10px]">{ln.params.preimage}</span>
                  </DetailRow>
                )}
              </div>
              {ln.commitment_signals && ln.tx_type === 'commitment' && (
                <div className="flex gap-4 mt-3 text-[11px] font-mono">
                  <span style={{ color: ln.commitment_signals.locktime_match ? '#22c55e' : '#374151' }}>
                    {ln.commitment_signals.locktime_match ? '✓' : '✗'} locktime
                  </span>
                  <span style={{ color: ln.commitment_signals.sequence_match ? '#22c55e' : '#374151' }}>
                    {ln.commitment_signals.sequence_match ? '✓' : '✗'} sequence
                  </span>
                  <span style={{ color: ln.commitment_signals.has_anchor_outputs ? '#22c55e' : '#374151' }}>
                    {ln.commitment_signals.has_anchor_outputs ? '✓' : '✗'} anchors ({ln.commitment_signals.anchor_output_count})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Security Alerts */}
          {alerts.length > 0 && (
            <>
              <SectionHeader>Security Alerts ({alerts.length})</SectionHeader>
              <div className="space-y-2">
                {alerts.map((alert: ApiAlert) => {
                  const c = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.informational;
                  return (
                    <div
                      key={alert.id}
                      data-testid="alert-item"
                      className={`rounded border-l-[3px] border px-4 py-3 ${c.bg} ${c.border}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <SeverityBadge severity={alert.severity} />
                        <DetectionBadge type={alert.detection_type} />
                      </div>
                      <p className={`text-sm leading-relaxed ${c.text}`}>{alert.description}</p>
                      {alert.reference && (
                        <p className="text-[11px] text-muted-foreground mt-2 font-mono">
                          <strong>{alert.reference.name}</strong> — {alert.reference.year}
                          {alert.reference.url && (
                            <a href={alert.reference.url} target="_blank" rel="noreferrer" className="text-primary ml-2 hover:underline">
                              paper ↗
                            </a>
                          )}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* nLockTime */}
          <SectionHeader>nLockTime</SectionHeader>
          <div className="rounded border border-border bg-card p-3 space-y-0 divide-y divide-border/50">
            <DetailRow label="value"><span className="font-mono">{nlocktime?.raw_value ?? '—'}</span></DetailRow>
            <DetailRow label="domain"><span className="font-mono">{nlocktime?.domain ?? 'n/a'}</span></DetailRow>
            <DetailRow label="active">
              <span className="font-mono" style={{ color: nlocktimeActive ? '#22c55e' : '#ef4444' }}>
                {nlocktimeActive ? 'yes' : 'no'}
              </span>
            </DetailRow>
            <DetailRow label="readable">
              <span data-testid="nlocktime-value">{nlocktime?.human_readable ?? '—'}</span>
            </DetailRow>
          </div>

          {/* Inputs / nSequence */}
          {inputs.length > 0 && (
            <>
              <SectionHeader>Inputs / nSequence ({inputs.length})</SectionHeader>
              <div className="space-y-2">
                {inputs.map((inp) => (
                  <div key={inp.input_index} className="rounded border border-border bg-card p-3">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-xs font-semibold text-primary">input[{inp.input_index}]</span>
                      <span className="font-mono text-xs text-muted-foreground">{inp.raw_hex}</span>
                    </div>
                    <div className="space-y-0 divide-y divide-border/50">
                      <DetailRow label="meaning"><span className="font-mono">{inp.meaning}</span></DetailRow>
                      {inp.relative_timelock && (
                        <>
                          <DetailRow label="domain"><span className="font-mono">{inp.relative_timelock.domain}</span></DetailRow>
                          <DetailRow label="value"><span className="font-mono">{inp.relative_timelock.value}</span></DetailRow>
                          <DetailRow label="readable">{inp.relative_timelock.human_readable}</DetailRow>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* CLTV */}
          {cltvTimelocks.length > 0 && (
            <>
              <SectionHeader>OP_CHECKLOCKTIMEVERIFY ({cltvTimelocks.length})</SectionHeader>
              <div className="space-y-2">
                {cltvTimelocks.map((c, i) => (
                  <div key={i} className="rounded border border-border bg-card p-3 space-y-0 divide-y divide-border/50">
                    <DetailRow label="input"><span className="font-mono text-primary">input[{c.input_index}]</span></DetailRow>
                    <DetailRow label="script field"><span className="font-mono text-xs">{c.script_field}</span></DetailRow>
                    <DetailRow label="raw value"><span className="font-mono">{c.raw_value.toLocaleString()}</span></DetailRow>
                    <DetailRow label="domain"><span className="font-mono">{c.domain}</span></DetailRow>
                    <DetailRow label="readable">{c.human_readable}</DetailRow>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* CSV */}
          {csvTimelocks.length > 0 && (
            <>
              <SectionHeader>OP_CHECKSEQUENCEVERIFY ({csvTimelocks.length})</SectionHeader>
              <div className="space-y-2">
                {csvTimelocks.map((c, i) => (
                  <div key={i} className="rounded border border-border bg-card p-3 space-y-0 divide-y divide-border/50">
                    <DetailRow label="input"><span className="font-mono text-primary">input[{c.input_index}]</span></DetailRow>
                    <DetailRow label="script field"><span className="font-mono text-xs">{c.script_field}</span></DetailRow>
                    <DetailRow label="raw value"><span className="font-mono">{c.raw_value.toLocaleString()}</span></DetailRow>
                    <DetailRow label="domain"><span className="font-mono">{c.domain}</span></DetailRow>
                    <DetailRow label="readable">{c.human_readable}</DetailRow>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Summary grid */}
          {summary && (
            <>
              <SectionHeader>Summary</SectionHeader>
              <div className="rounded border border-border bg-card p-4">
                <div className="grid grid-cols-5 gap-4 text-center">
                  {[
                    { label: 'Active',    value: summary.has_active_timelocks ? '✓' : '—', color: summary.has_active_timelocks ? '#22c55e' : '#374151' },
                    { label: 'nLockTime', value: summary.nlocktime_active ? '✓' : '—',      color: summary.nlocktime_active ? '#67e8f9' : '#374151' },
                    { label: 'nSeq',      value: summary.relative_timelock_count ?? '—',    color: (summary.relative_timelock_count ?? 0) > 0 ? '#fbbf24' : '#374151' },
                    { label: 'CLTV',      value: summary.cltv_count ?? '—',                 color: (summary.cltv_count ?? 0) > 0 ? '#f87171' : '#374151' },
                    { label: 'CSV',       value: summary.csv_count ?? '—',                  color: (summary.csv_count ?? 0) > 0 ? '#a78bfa' : '#374151' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="font-mono font-bold text-sm" style={{ color: item.color }}>
                        {String(item.value)}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
