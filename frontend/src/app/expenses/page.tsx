'use client';
import { useEffect, useState } from 'react';
import { expensesApi, formatApiError } from '@/lib/api';
import { formatRupiah, formatDate, toLocalDateString } from '@/lib/utils';
import { usePeriod } from '@/hooks/usePeriod';
import PeriodFilter from '@/components/PeriodFilter';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const CATEGORIES = ['Bahan Baku', 'Kemasan', 'Gas & Listrik', 'Gaji', 'Transport', 'Marketing', 'Sewa', 'Lainnya'];

export default function ExpensesPage() {
  const { from, to, ready, setPeriod, label } = usePeriod();
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summaryTotal, setSummaryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ description: '', category: '', amount: '', expenseDate: toLocalDateString(new Date()) });

  useEffect(() => {
    if (!ready) return;
    setDraftFrom(from);
    setDraftTo(to);
  }, [ready, from, to]);

  const load = async (f = from, t = to) => {
    setLoading(true);
    setError('');
    try {
      const [listRes, sumRes] = await Promise.all([
        expensesApi.list({ from: f, to: t, limit: 100 }),
        expensesApi.summary(f, t),
      ]);
      setExpenses(listRes.data.data);
      const data = sumRes.data;
      const totalFromSummary =
        typeof data?.total === 'number'
          ? data.total
          : Array.isArray(data)
            ? data.reduce((a: number, r: any) => a + Number(r.total ?? r._sum?.amount ?? 0), 0)
            : Array.isArray(data?.byCategory)
              ? data.byCategory.reduce((a: number, r: any) => a + Number(r.total ?? 0), 0)
              : 0;
      setSummaryTotal(Number(totalFromSummary) || 0);
    } catch (err) {
      setExpenses([]);
      setSummaryTotal(0);
      setError(formatApiError(err, 'Gagal memuat biaya'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    load(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, from, to]);

  const openAdd = () => {
    setEditing(null);
    setForm({ description: '', category: '', amount: '', expenseDate: toLocalDateString(new Date()) });
    setShowForm(true);
  };
  const openEdit = (e: any) => {
    setEditing(e);
    setForm({
      description: e.description,
      category: e.category,
      amount: e.amount,
      expenseDate: e.expenseDate?.split('T')[0],
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editing) await expensesApi.update(editing.id, payload);
      else await expensesApi.create(payload);
      setShowForm(false);
      load();
    } catch (err) {
      setError(formatApiError(err, 'Gagal menyimpan biaya'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus biaya ini?')) return;
    try {
      await expensesApi.delete(id);
      load();
    } catch (err) {
      setError(formatApiError(err, 'Gagal menghapus biaya'));
    }
  };

  const totalAmount = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const displayTotal = summaryTotal > 0 ? summaryTotal : totalAmount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Biaya Operasional</h1>
          <p className="text-gray-500 text-sm mt-1">
            {label} · Total: {formatRupiah(displayTotal)}
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Tambah Biaya
        </button>
      </div>

      <PeriodFilter
        from={draftFrom}
        to={draftTo}
        onFromChange={setDraftFrom}
        onToChange={setDraftTo}
        onApply={() => setPeriod(draftFrom, draftTo)}
        applying={loading}
      />

      {error && (
        <div className="card border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {showForm && (
        <div className="card border-amber-200 bg-amber-50">
          <h2 className="font-semibold mb-4">{editing ? 'Edit Biaya' : 'Tambah Biaya'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Keterangan</label>
              <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Contoh: Beli tepung 10kg" />
            </div>
            <div>
              <label className="label">Kategori</label>
              <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">Pilih Kategori</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Jumlah (Rp)</label>
              <input type="number" className="input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Tanggal</label>
              <input type="date" className="input" value={form.expenseDate} onChange={e => setForm({ ...form, expenseDate: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} className="btn-primary">Simpan</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Batal</button>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? <div className="text-center py-12 text-gray-400">Memuat...</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                <th className="pb-3 pr-4">Tanggal</th>
                <th className="pb-3 pr-4">Keterangan</th>
                <th className="pb-3 pr-4">Kategori</th>
                <th className="pb-3 pr-4 text-right">Jumlah</th>
                <th className="pb-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">Belum ada data biaya</td></tr>
              ) : expenses.map(e => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 pr-4 text-gray-600">{formatDate(e.expenseDate)}</td>
                  <td className="py-3 pr-4">{e.description}</td>
                  <td className="py-3 pr-4"><span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">{e.category}</span></td>
                  <td className="py-3 pr-4 text-right font-medium text-red-600">{formatRupiah(Number(e.amount))}</td>
                  <td className="py-3 text-right">
                    <button onClick={() => openEdit(e)} className="p-1 text-gray-400 hover:text-amber-600 mr-2"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(e.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
