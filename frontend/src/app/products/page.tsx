'use client';
import { useEffect, useState } from 'react';
import { productsApi } from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', categoryId: '', sellingPrice: '', hpp: '' });

  const load = async () => {
    setLoading(true);
    const [p, c] = await Promise.all([productsApi.list(), productsApi.categories()]);
    setProducts(p.data);
    setCategories(c.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: '', categoryId: '', sellingPrice: '', hpp: '' }); setShowForm(true); };
  const openEdit = (p: any) => { setEditing(p); setForm({ name: p.name, categoryId: p.categoryId, sellingPrice: p.sellingPrice, hpp: p.hpp }); setShowForm(true); };

  const handleSave = async () => {
    const payload = { ...form, sellingPrice: Number(form.sellingPrice), hpp: Number(form.hpp) };
    if (editing) await productsApi.update(editing.id, payload);
    else await productsApi.create(payload);
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Nonaktifkan produk ini?')) return;
    await productsApi.delete(id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produk</h1>
          <p className="text-gray-500 text-sm mt-1">{products.length} produk terdaftar</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Tambah Produk
        </button>
      </div>

      {showForm && (
        <div className="card border-amber-200 bg-amber-50">
          <h2 className="font-semibold mb-4">{editing ? 'Edit Produk' : 'Tambah Produk'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nama Produk</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Kategori</label>
              <select className="input" value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Pilih Kategori</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Harga Jual (Rp)</label>
              <input type="number" className="input" value={form.sellingPrice} onChange={e => setForm({ ...form, sellingPrice: e.target.value })} />
            </div>
            <div>
              <label className="label">HPP / Harga Modal (Rp)</label>
              <input type="number" className="input" value={form.hpp} onChange={e => setForm({ ...form, hpp: e.target.value })} />
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                  <th className="pb-3 pr-4">Nama Produk</th>
                  <th className="pb-3 pr-4">Kategori</th>
                  <th className="pb-3 pr-4 text-right">Harga Jual</th>
                  <th className="pb-3 pr-4 text-right">HPP</th>
                  <th className="pb-3 pr-4 text-right">Margin</th>
                  <th className="pb-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const margin = ((Number(p.sellingPrice) - Number(p.hpp)) / Number(p.sellingPrice) * 100).toFixed(1);
                  return (
                    <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50 ${!p.isActive ? 'opacity-50' : ''}`}>
                      <td className="py-3 pr-4 font-medium">{p.name}</td>
                      <td className="py-3 pr-4 text-gray-500">{p.category?.name}</td>
                      <td className="py-3 pr-4 text-right">{formatRupiah(Number(p.sellingPrice))}</td>
                      <td className="py-3 pr-4 text-right text-gray-500">{formatRupiah(Number(p.hpp))}</td>
                      <td className="py-3 pr-4 text-right">
                        <span className={`font-medium ${Number(margin) > 40 ? 'text-green-600' : 'text-orange-500'}`}>{margin}%</span>
                      </td>
                      <td className="py-3 text-right">
                        <button onClick={() => openEdit(p)} className="p-1 text-gray-400 hover:text-amber-600 mr-2"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
