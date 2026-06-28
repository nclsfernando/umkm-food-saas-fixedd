'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setError('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/orders/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal mengimport file.');
    } finally {
      setLoading(false);
    }
  };

  const marketplaces = [
    { name: 'GrabFood', color: 'bg-green-100 text-green-700 border-green-200', icon: '🟢', desc: 'GrabMerchant_Reports_*.xlsx' },
    { name: 'GoFood', color: 'bg-red-100 text-red-700 border-red-200', icon: '🔴', desc: 'File laporan GoBiz *.xlsx / *.csv' },
    { name: 'ShopeeFood', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: '🟠', desc: 'ShopeeFood order export *.xlsx / *.csv' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
            ← Kembali
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Import Mutasi Marketplace</h1>
            <p className="text-gray-500 text-sm">Upload file laporan dari GrabFood, GoFood, atau ShopeeFood</p>
          </div>
        </div>

        {/* Marketplace badges */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {marketplaces.map(m => (
            <div key={m.name} className={`border rounded-xl p-3 ${m.color}`}>
              <div className="text-lg mb-1">{m.icon} {m.name}</div>
              <div className="text-xs opacity-75">{m.desc}</div>
            </div>
          ))}
        </div>

        {/* Upload area */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-4">
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer
              ${dragging ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50'}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-4xl mb-3">📂</div>
            {file ? (
              <div>
                <p className="font-semibold text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-gray-600">Drag & drop file di sini</p>
                <p className="text-sm text-gray-400 mt-1">atau klik untuk pilih file</p>
                <p className="text-xs text-gray-300 mt-2">Mendukung .xlsx dan .csv</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-red-700 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
            <p className="font-semibold text-green-800 text-lg mb-2">✅ Import Berhasil!</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{result.created}</p>
                <p className="text-sm text-gray-500">Pesanan ditambahkan</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-400">{result.skipped}</p>
                <p className="text-sm text-gray-500">Dilewati</p>
              </div>
            </div>
            <button onClick={() => router.push('/orders')}
              className="mt-3 w-full text-sm text-green-700 underline">
              Lihat data pesanan →
            </button>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!file || loading}
          className="w-full py-3 px-6 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400
            text-white font-semibold rounded-xl transition-colors"
        >
          {loading ? '⏳ Mengimport...' : '📥 Import Sekarang'}
        </button>

        {/* Guide */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="font-semibold text-blue-800 text-sm mb-2">📋 Panduan</p>
          <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
            <li>GrabFood: Download dari GrabMerchant → Laporan → Export</li>
            <li>GoFood: Download dari GoBiz → Laporan Keuangan → Export</li>
            <li>ShopeeFood: Download dari ShopeeFood Partner → Pesanan → Export</li>
            <li>Nama file akan digunakan untuk deteksi otomatis marketplace</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
