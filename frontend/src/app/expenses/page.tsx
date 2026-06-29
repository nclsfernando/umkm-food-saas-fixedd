'use client';
import { useEffect, useState } from 'react';
import { expensesApi } from '@/lib/api';
import { formatRupiah, formatDate, thisMonthRange } from '@/lib/utils';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const CATEGORIES = ['Bahan Baku', 'Kemasan', 'Gas & Listrik', 'Gaji', 'Transport', 'Marketing', 'Sewa', 'Lainnya'];

export default function ExpensesPage() {
  const { from: df, to: dt } = thisMonthRange();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState(df);
  const [to, setTo] = useState(dt);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ description: '', category: '', amount: '', expenseDate: new Date().toISOString().split('T')[0] });

  const load = async () => {
    setLoading(true);
    const res = await expensesApi.list({ from, to, limit: 100 });
    setExpenses(res.data.data);
    setTotal(res.data.total);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ description: '', category: '', amount: '', expenseDate: new Date().toISOString().split('T')[0] }); setShowForm(true); };
  const openEdit = (e: any) => { setEditing(e); setForm({ description: e.description, category: e.category, amount: e.amount, expenseDate: e.expenseDate?.split('T')[0] }); setShowForm(true); };

  const handleSave = async () => {
    const payload = { ...form, amount: Number(form.amount) };
    if (editing) await expensesApi.update(editing.id, payload);
    else await expensesApi.create(payload);
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus biaya ini?')) return;
    await expensesApi.delete(id);
    load();
  };

  const totalAmount = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Biaya Operasional</h1>
          <p className="text-gray-500 text-sm mt-1">Total: {formatRupiah(totalAmount)}</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Tambah Biaya
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input type="date" className="input w-auto" value={from} onChange={e => setFrom(e.target.value)} />
        <input type="date" className="input w-auto" value={to} onChange={e => setTo(e.target.value)} />
        <button onClick={load} className="btn-primary">Tampilkan</button>
      </div>

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
