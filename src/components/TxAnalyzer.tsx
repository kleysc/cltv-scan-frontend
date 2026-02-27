import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api, ApiError } from '@/lib/api';
import type { TxAnalysisResponse, SequenceInfo, ScriptTimelockInfo, Alert as ApiAlert } from '@/types/api';

export function TxAnalyzer() {
  const [txid, setTxid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TxAnalysisResponse | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txid.trim()) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await api.getTransaction(txid.trim());
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

  const notableSequences = data?.timelock.sequences.filter(
    (seq) => !(seq.is_final && !seq.rbf_signaling)
  ) || [];

  const hasCriticalAlerts = data?.alerts.some((alert) => alert.severity === 'critical') || false;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Transaction Analyzer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="flex gap-2">
              <Input
                data-testid="txid-input"
                placeholder="Enter transaction ID (txid)"
                value={txid}
                onChange={(e) => setTxid(e.target.value)}
                disabled={loading}
              />
              <Button data-testid="analyze-btn" type="submit" disabled={loading || !txid.trim()}>
                {loading ? 'Analyzing...' : 'Analyze'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" data-testid="tx-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hasCriticalAlerts && (
        <Alert variant="destructive" data-testid="critical-banner">
          <AlertDescription className="font-bold">
            ⚠️ CRITICAL SECURITY ALERTS DETECTED
          </AlertDescription>
        </Alert>
      )}

      {data && (
        <div className="space-y-4">
          {/* Transaction Info */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Transaction ID</div>
                <div data-testid="tx-txid" className="font-mono text-sm break-all">
                  {data.timelock.txid}
                </div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground">nLocktime</div>
                <div data-testid="nlocktime-value" className="font-mono">
                  {data.timelock.nlocktime.human_readable}
                </div>
                <div data-testid="nlocktime-enforced" className="text-sm">
                  {data.timelock.nlocktime.is_enforced ? 'Enforced' : 'Disabled'}
                </div>
              </div>

              {notableSequences.length > 0 && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Notable Sequences</div>
                  <div data-testid="sequences-list" className="space-y-2">
                    {notableSequences.map((seq: SequenceInfo) => (
                      <div key={seq.input_index} className="border rounded p-2 text-sm">
                        <div className="font-mono">Input #{seq.input_index}: {seq.human_readable}</div>
                        {seq.is_lightning_sequence && (
                          <div className="text-xs text-blue-600">⚡ Lightning Sequence</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.timelock.script_timelocks.length > 0 && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Script Timelocks</div>
                  <div data-testid="script-timelocks-list" className="space-y-2">
                    {data.timelock.script_timelocks.map((st: ScriptTimelockInfo, idx: number) => (
                      <div key={idx} className="border rounded p-2 text-sm">
                        <div className="font-mono">{st.opcode}: {st.human_readable}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lightning Info */}
          <Card>
            <CardHeader>
              <CardTitle>Lightning Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm text-muted-foreground">Type: </span>
                <span data-testid="ln-type" className="font-mono">
                  {data.lightning.tx_type || 'not lightning'}
                </span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Confidence: </span>
                <span data-testid="ln-confidence" className="font-mono">
                  {data.lightning.confidence}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>
                Security Alerts
                <span data-testid="alerts-count" className="ml-2 text-sm text-muted-foreground">
                  ({data.alerts.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.alerts.length === 0 ? (
                <div className="text-sm text-muted-foreground">No alerts detected</div>
              ) : (
                <div className="space-y-2">
                  {data.alerts.map((alert: ApiAlert) => (
                    <div
                      key={alert.id}
                      data-testid="alert-item"
                      className={`border rounded p-3 ${
                        alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
                        alert.severity === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                        'border-blue-500 bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm uppercase">{alert.severity}</span>
                        <span className="text-xs text-muted-foreground">{alert.detection_type}</span>
                      </div>
                      <div className="text-sm">{alert.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
