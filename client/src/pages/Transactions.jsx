import TransactionsTable from '../components/TransactionsTable';

export default function Transactions() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">תנועות</h2>
      <TransactionsTable />
    </div>
  );
}
