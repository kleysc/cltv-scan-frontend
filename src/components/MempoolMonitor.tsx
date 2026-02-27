import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type { MonitorEvent, AlertSeverity } from '@/types/api';

type ConnectionStatus = 'disconnected' | 'connected' | 'error';

interface MonitorEventDisplay extends MonitorEvent {
  receivedAt: number;
}

const MAX_EVENTS = 200;

const SEVERITY_ROW: Record<AlertSeverity, string> = {
  critical:      'rgba(239,68,68,0.07)',
  warning:       'rgba(245,158,11,0.06)',
  informational: 'rgba(59,130,246,0.06)',
};

const SEVERITY_BADGE_STYLE: Record<AlertSeverity, { bg: string; text: string }> = {
  critical:      { bg: '#ef4444', text: '#fff' },
  warning:       { bg: '#f59e0b', text: '#000' },
  informational: { bg: '#3b82f6', text: '#fff' },
};

const LN_TYPE_LABELS: Record<string, string> = {
  commitment:   'Commitment',
  htlc_timeout: 'HTLC Timeout',
  htlc_success: 'HTLC Success',
};

function getMaxSeverity(alerts: MonitorEvent['alerts']): AlertSeverity | null {
  if (alerts.length === 0) return null;
  if (alerts.some((a) => a.severity === 'critical')) return 'critical';
  if (alerts.some((a) => a.severity === 'warning')) return 'warning';
  return 'informational';
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  const color = status === 'connected' ? '#22c55e' : status === 'error' ? '#ef4444' : '#374151';
  const shadow = status === 'connected' ? '0 0 6px #22c55e' : 'none';
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${status === 'connected' ? 'animate-pulse' : ''}`}
      style={{ background: color, boxShadow: shadow }}
    />
  );
}

interface MempoolMonitorProps {
  onTxClick?: (txid: string) => void;
}

export function MempoolMonitor({ onTxClick }: MempoolMonitorProps) {
  const [intervalSecs, setIntervalSecs] = useState('10');
  const [minSeverity, setMinSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [events, setEvents] = useState<MonitorEventDisplay[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleStart = () => {
    eventSourceRef.current?.close();
    const intervalNum = Number.parseInt(intervalSecs, 10) || 10;
    const es = api.createMonitorStream({ interval: intervalNum, min_severity: minSeverity });

    es.onopen = () => setStatus('connected');
    es.addEventListener('tx', (e: MessageEvent) => {
      try {
        const payload: MonitorEvent = JSON.parse(e.data);
        setEvents((prev) => [{ ...payload, receivedAt: Date.now() }, ...prev].slice(0, MAX_EVENTS));
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    });
    es.onerror = () => { setStatus('error'); es.close(); };
    eventSourceRef.current = es;
  };

  const handleStop = () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setStatus('disconnected');
  };

  useEffect(() => { return () => { eventSourceRef.current?.close(); }; }, []);

  const criticalCount = events.filter((e) => getMaxSeverity(e.alerts) === 'critical').length;

  return (
    <div className="space-y-4">
      {/* Controls card */}
      <div className="rounded border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-3">
          <StatusDot status={status} />
          <span
            data-testid="monitor-status"
            className="font-mono text-xs capitalize"
            style={{ color: status === 'connected' ? '#22c55e' : status === 'error' ? '#ef4444' : '#64748b' }}
          >
            {status}
          </span>
          {events.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span
                data-testid="monitor-event-count"
                className="font-mono text-[11px] text-muted-foreground"
              >
                {events.length} event{events.length !== 1 ? 's' : ''}
              </span>
              {criticalCount > 0 && (
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-sm bg-red-600 text-white">
                  {criticalCount} critical
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <label htmlFor="monitor-interval" className="font-mono text-[11px] text-muted-foreground">
              Interval (seconds)
            </label>
            <input
              id="monitor-interval"
              data-testid="monitor-interval"
              type="number"
              min="5"
              placeholder="10"
              value={intervalSecs}
              onChange={(e) => setIntervalSecs(e.target.value)}
              disabled={status === 'connected'}
              className="w-28 bg-background border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="monitor-min-severity" className="font-mono text-[11px] text-muted-foreground">
              Min severity
            </label>
            <select
              id="monitor-min-severity"
              data-testid="monitor-min-severity"
              value={minSeverity}
              onChange={(e) => setMinSeverity(e.target.value as typeof minSeverity)}
              disabled={status === 'connected'}
              className="w-44 bg-background border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground outline-none focus:border-primary/50 transition-colors disabled:opacity-50 appearance-none"
            >
              <option value="info">Info and above</option>
              <option value="warning">Warning and above</option>
              <option value="critical">Critical only</option>
            </select>
          </div>

          <div className="flex gap-2 pb-0.5">
            <button
              data-testid="monitor-start-btn"
              type="button"
              onClick={handleStart}
              disabled={status === 'connected'}
              className="px-3 py-1.5 rounded font-mono text-xs font-semibold bg-primary text-background hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'error' ? 'Reconnect' : 'Start'}
            </button>
            <button
              data-testid="monitor-stop-btn"
              type="button"
              onClick={handleStop}
              disabled={status === 'disconnected'}
              className="px-3 py-1.5 rounded font-mono text-xs border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Stop
            </button>
            <button
              data-testid="monitor-clear-btn"
              type="button"
              onClick={() => setEvents([])}
              disabled={events.length === 0}
              className="px-3 py-1.5 rounded font-mono text-xs text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {status === 'error' && (
          <p className="font-mono text-[11px] text-red-400">
            Connection lost. Click Reconnect to try again.
          </p>
        )}
      </div>

      {/* Live feed */}
      <div className="rounded border border-border bg-card p-4">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
          Live Feed
        </h3>
        <div
          data-testid="monitor-feed"
          className="space-y-1.5 max-h-[560px] overflow-y-auto"
        >
          {events.length === 0 ? (
            <p className="text-center py-10 font-mono text-xs text-muted-foreground/40">
              {status === 'connected'
                ? 'Waiting for transactions…'
                : 'Start monitoring to receive transactions.'}
            </p>
          ) : (
            events.map((event, idx) => {
              const maxSev = getMaxSeverity(event.alerts);
              const hasTimelocks = event.timelock.summary.has_active_timelocks;
              const rowBg = maxSev ? SEVERITY_ROW[maxSev] : '#111318';

              return (
                <div
                  key={`${event.txid}-${idx}`}
                  data-testid="monitor-event"
                  className="rounded px-3 py-2 cursor-pointer hover:brightness-125 transition-all"
                  style={{
                    background: rowBg,
                    border: `1px solid ${maxSev ? 'rgba(255,255,255,0.06)' : '#1e2028'}`,
                  }}
                  onClick={() => onTxClick?.(event.txid)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      data-testid="monitor-event-txid"
                      className="font-mono text-[11px] text-primary truncate flex-1 hover:underline"
                    >
                      {event.txid.slice(0, 16)}…{event.txid.slice(-8)}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground/50 shrink-0">
                      {new Date(event.receivedAt).toLocaleTimeString()}
                    </span>
                  </div>

                  {(event.lightning.tx_type || hasTimelocks || event.alerts.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {event.lightning.tx_type && (
                        <span
                          data-testid="monitor-event-ln-type"
                          className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-yellow-400/10 text-yellow-300 border border-yellow-500/20"
                        >
                          {LN_TYPE_LABELS[event.lightning.tx_type] ?? event.lightning.tx_type}
                        </span>
                      )}
                      {hasTimelocks && (
                        <span
                          data-testid="monitor-event-timelocks"
                          className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-purple-900/30 text-purple-300 border border-purple-800/30"
                        >
                          active timelocks
                        </span>
                      )}
                      {maxSev && (
                        <span
                          data-testid="monitor-event-severity"
                          className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-sm"
                          style={{ background: SEVERITY_BADGE_STYLE[maxSev].bg, color: SEVERITY_BADGE_STYLE[maxSev].text }}
                        >
                          {maxSev.toUpperCase()}
                        </span>
                      )}
                      {event.alerts.length > 0 && (
                        <span
                          data-testid="monitor-event-alerts-count"
                          className="font-mono text-[10px] text-muted-foreground/60"
                        >
                          {event.alerts.length} alert{event.alerts.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
