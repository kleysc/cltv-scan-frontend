import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api, ApiError } from '@/lib/api';
import type { LightningResponse, LightningTransaction } from '@/types/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function LightningDashboard() {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LightningResponse | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const startNum = parseInt(start, 10);
    const endNum = end ? parseInt(end, 10) : undefined;

    if (!startNum || startNum < 0) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await api.lightning({
        start: startNum,
        end: endNum,
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Lightning Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Start Height</label>
                <Input
                  data-testid="ln-start"
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
                  data-testid="ln-end"
                  type="number"
                  placeholder="End block height"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            <Button data-testid="ln-btn" type="submit" disabled={loading || !start}>
              {loading ? 'Analyzing...' : 'Analyze'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" data-testid="ln-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Scanned</div>
                  <div data-testid="ln-total-scanned" className="text-2xl font-bold">
                    {data.total_transactions_scanned}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Commitments</div>
                  <div data-testid="ln-commitments" className="text-2xl font-bold text-blue-600">
                    {data.commitments}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">HTLC Timeouts</div>
                  <div data-testid="ln-htlc-timeouts" className="text-2xl font-bold text-orange-600">
                    {data.htlc_timeouts}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">HTLC Successes</div>
                  <div data-testid="ln-htlc-successes" className="text-2xl font-bold text-green-600">
                    {data.htlc_successes}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {data.cltv_expiry_distribution.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>CLTV Expiry Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div data-testid="expiry-chart" className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.cltv_expiry_distribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="block_height" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {data.transactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Lightning Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.transactions.map((tx: LightningTransaction) => (
                    <div
                      key={tx.txid}
                      data-testid="ln-tx-row"
                      className="border rounded p-3 flex items-center justify-between"
                    >
                      <div className="font-mono text-sm truncate flex-1">{tx.txid}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {tx.classification.tx_type}
                        </span>
                        <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
                          {tx.classification.confidence}
                        </span>
                      </div>
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
