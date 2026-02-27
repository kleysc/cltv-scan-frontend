import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import type { MonitorEvent, AlertSeverity } from '@/types/api';

type ConnectionStatus = 'disconnected' | 'connected' | 'error';

interface MonitorEventDisplay extends MonitorEvent {
  timestamp: number;
}

const MAX_EVENTS = 200;

export function MempoolMonitor() {
  const [interval, setInterval] = useState('10');
  const [minSeverity, setMinSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [events, setEvents] = useState<MonitorEventDisplay[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleStart = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const intervalNum = parseInt(interval, 10) || 10;
    const es = api.createMonitorStream({
      interval: intervalNum,
      min_severity: minSeverity,
    });

    es.onopen = () => {
      setStatus('connected');
    };

    es.addEventListener('tx', (e: MessageEvent) => {
      try {
        const payload: MonitorEvent = JSON.parse(e.data);
        const displayEvent: MonitorEventDisplay = {
          ...payload,
          timestamp: Date.now(),
        };

        setEvents((prev) => {
          const next = [displayEvent, ...prev];
          return next.slice(0, MAX_EVENTS);
        });
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    });

    es.onerror = () => {
      setStatus('error');
      es.close();
    };

    eventSourceRef.current = es;
  };

  const handleStop = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('disconnected');
  };

  const handleClear = () => {
    setEvents([]);
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const getMaxSeverity = (alerts: MonitorEvent['alerts']): AlertSeverity | null => {
    if (alerts.length === 0) return null;
    if (alerts.some((a) => a.severity === 'critical')) return 'critical';
    if (alerts.some((a) => a.severity === 'warning')) return 'warning';
    return 'informational';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Mempool Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Interval (seconds)</label>
                <Input
                  data-testid="monitor-interval"
                  type="number"
                  placeholder="Interval in seconds"
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  disabled={status === 'connected'}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Min Severity</label>
                <Select 
                  value={minSeverity} 
                  onValueChange={(v) => setMinSeverity(v as typeof minSeverity)}
                  disabled={status === 'connected'}
                >
                  <SelectTrigger data-testid="monitor-min-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                data-testid="monitor-start-btn"
                onClick={handleStart}
                disabled={status === 'connected'}
                variant={status === 'connected' ? 'secondary' : 'default'}
              >
                Start Monitoring
              </Button>
              <Button
                data-testid="monitor-stop-btn"
                onClick={handleStop}
                disabled={status === 'disconnected'}
                variant="destructive"
              >
                Stop
              </Button>
              <Button
                data-testid="monitor-clear-btn"
                onClick={handleClear}
                variant="outline"
              >
                Clear
              </Button>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Status: </span>
                <span
                  data-testid="monitor-status"
                  className={`font-mono ${
                    status === 'connected' ? 'text-green-600' :
                    status === 'error' ? 'text-red-600' :
                    'text-gray-600'
                  }`}
                >
                  {status}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Events: </span>
                <span data-testid="monitor-event-count" className="font-mono">
                  {events.length}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <div data-testid="monitor-feed" className="space-y-2 max-h-[600px] overflow-y-auto">
            {events.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                No events received yet. Click "Start Monitoring" to begin.
              </div>
            ) : (
              events.map((event, idx) => {
                const maxSeverity = getMaxSeverity(event.alerts);
                const hasActiveTimelocks = event.timelock.summary.has_active_timelocks;

                return (
                  <div
                    key={`${event.txid}-${idx}`}
                    data-testid="monitor-event"
                    className={`border rounded p-3 ${
                      maxSeverity === 'critical' ? 'border-red-500 bg-red-50' :
                      maxSeverity === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                      event.alerts.length > 0 ? 'border-blue-500 bg-blue-50' :
                      'border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div data-testid="monitor-event-txid" className="font-mono text-sm truncate flex-1">
                        {event.txid}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      {event.lightning.tx_type && (
                        <span
                          data-testid="monitor-event-ln-type"
                          className="bg-blue-100 text-blue-800 px-2 py-1 rounded"
                        >
                          ⚡ {event.lightning.tx_type}
                        </span>
                      )}

                      {event.alerts.length > 0 && (
                        <>
                          <span
                            data-testid="monitor-event-alerts-count"
                            className="bg-gray-100 text-gray-800 px-2 py-1 rounded"
                          >
                            {event.alerts.length} alert{event.alerts.length !== 1 ? 's' : ''}
                          </span>
                          {maxSeverity && (
                            <span
                              data-testid="monitor-event-severity"
                              className={`px-2 py-1 rounded font-bold ${
                                maxSeverity === 'critical' ? 'bg-red-200 text-red-900' :
                                maxSeverity === 'warning' ? 'bg-yellow-200 text-yellow-900' :
                                'bg-blue-200 text-blue-900'
                              }`}
                            >
                              {maxSeverity.toUpperCase()}
                            </span>
                          )}
                        </>
                      )}

                      {hasActiveTimelocks && (
                        <span
                          data-testid="monitor-event-timelocks"
                          className="bg-purple-100 text-purple-800 px-2 py-1 rounded"
                        >
                          active
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
