import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import type { ScanResponse, Alert as ApiAlert } from '@/types/api';

export function SecurityScanner() {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [severity, setSeverity] = useState<'' | 'critical' | 'warning' | 'informational'>('');
  const [detectionType, setDetectionType] = useState<'' | 'timelock_mixing' | 'short_cltv_delta' | 'htlc_clustering' | 'anomalous_sequence'>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScanResponse | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const startNum = parseInt(start, 10);
    const endNum = end ? parseInt(end, 10) : undefined;

    if (!startNum || startNum < 0) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await api.scan({
        start: startNum,
        end: endNum,
        severity: severity || undefined,
        detection_type: detectionType || undefined,
      });
      setData(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const criticalCount = data?.alerts.filter((a) => a.severity === 'critical').length || 0;
  const warningCount = data?.alerts.filter((a) => a.severity === 'warning').length || 0;
  const infoCount = data?.alerts.filter((a) => a.severity === 'informational').length || 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Security Scanner</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleScan} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Start Height</label>
                <Input
                  data-testid="scan-start"
                  type="number"
                  placeholder="Start block height"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">End Height (optional)</label>
                <Input
                  data-testid="scan-end"
                  type="number"
                  placeholder="End block height"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Severity</label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                  <SelectTrigger data-testid="scan-severity">
                    <SelectValue placeholder="All severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="informational">Informational</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Detection Type</label>
                <Select value={detectionType} onValueChange={(v) => setDetectionType(v as typeof detectionType)}>
                  <SelectTrigger data-testid="scan-detection-type">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    <SelectItem value="timelock_mixing">Timelock Mixing</SelectItem>
                    <SelectItem value="short_cltv_delta">Short CLTV Delta</SelectItem>
                    <SelectItem value="htlc_clustering">HTLC Clustering</SelectItem>
                    <SelectItem value="anomalous_sequence">Anomalous Sequence</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button data-testid="scan-btn" type="submit" disabled={loading || !start}>
              {loading ? 'Scanning...' : 'Scan'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" data-testid="scan-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scan Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Total Alerts</div>
                  <div data-testid="scan-total" className="text-2xl font-bold">{data.total_alerts}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Critical</div>
                  <div data-testid="scan-critical-count" className="text-2xl font-bold text-red-600">
                    {criticalCount}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Warning</div>
                  <div data-testid="scan-warning-count" className="text-2xl font-bold text-yellow-600">
                    {warningCount}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Informational</div>
                  <div data-testid="scan-info-count" className="text-2xl font-bold text-blue-600">
                    {infoCount}
                  </div>
                </div>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Current Tip: </span>
                <span data-testid="scan-current-tip" className="font-mono">{data.current_tip}</span>
              </div>
            </CardContent>
          </Card>

          {data.alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.alerts.map((alert: ApiAlert) => (
                    <div
                      key={alert.id}
                      data-testid="alert-item"
                      className={`border rounded p-4 ${
                        alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
                        alert.severity === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                        'border-blue-500 bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-sm uppercase">{alert.severity}</span>
                        <span className="text-xs bg-white px-2 py-1 rounded">{alert.detection_type}</span>
                        <span className="font-mono text-xs truncate">{alert.txid}</span>
                      </div>
                      <div className="text-sm mb-2">{alert.description}</div>

                      {alert.details.type === 'htlc_clustering' && (
                        <div data-testid="clustering-detail" className="text-xs bg-white p-2 rounded space-y-1">
                          <div>Window: {alert.details.window_start} - {alert.details.window_end}</div>
                          <div>Count: {alert.details.count} / Threshold: {alert.details.threshold}</div>
                        </div>
                      )}

                      {alert.details.type === 'short_cltv_delta' && (
                        <div data-testid="cltv-detail" className="text-xs bg-white p-2 rounded space-y-1">
                          <div>CLTV Expiry: {alert.details.cltv_expiry}</div>
                          <div>Current Height: {alert.details.current_height}</div>
                          <div>Blocks Remaining: {alert.details.blocks_remaining}</div>
                        </div>
                      )}

                      {alert.reference && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Reference: {alert.reference.name} ({alert.reference.year})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
