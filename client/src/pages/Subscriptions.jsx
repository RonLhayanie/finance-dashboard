import { useState } from 'react';
import SubscriptionsTable from '../components/SubscriptionsTable';
import { recomputeAnalytics } from '../api/client';

export default function Subscriptions() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  async function handleRecompute() {
    setPending(true);
    setMessage('');
    try {
      const result = await recomputeAnalytics();
      setMessage(
        `סווגו ${result.categorized} תנועות, עודכנו ${result.subscriptionsTouched} מנויים, סומנו ${result.anomaliesFlagged} חריגות.`
      );
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">מנויים</h2>
        <button
          onClick={handleRecompute}
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'מחשב מחדש...' : 'חישוב אנליטיקה מחדש'}
        </button>
      </div>
      {message && <p className="text-sm text-slate-400">{message}</p>}
      <SubscriptionsTable key={refreshKey} />
    </div>
  );
}
