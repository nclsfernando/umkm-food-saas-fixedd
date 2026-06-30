'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ name: string; created: number; skipped: number; error?: string }[]>([]);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setFiles(Array.from(newFiles));
    setResults([]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setResults([]);
    const newResults: { name: string; created: number; skipped: number; error?: string }[] = [];

    for (const file of files) {
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await api.post('/orders/import', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        newResults.push({ name: file.name, created: res.data.created || 0, skipped: res.data.skipped || 0 });
      } catch (err: any) {
        newResults.push({ name: file.name, created: 0, skipped: 0, error: err.response?.data?.message || 'Gagal' });
      }
      setResults([...newResults]);
    }
    setLoading(false);
  };

  const totalCreated = results.reduce((a, r) => a + r.created, 0);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Import Mutasi Marketplace</h1>
        <p className="text-gray-500 text-sm mt-1">Bisa pilih beberapa file sekaligus (GrabFood, GoFood, ShopeeFood)</p>
      </div>

      {/* Upload area */}
      <div className="card mb-4">
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
            ${dragging ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50'}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <div className="text-3xl mb-2">📂</div>
          {files.length > 0 ? (
            <div>
              <p className="font-semibold text-gray-800">{files.length} file dipilih</p>
              <p className="text-xs text-gray-400 mt-1">
                {files.map(f => f.name).slice(0, 2).join(', ')}{files.length > 2 ? ` +${files.length - 2} lagi` : ''}
              </p>
            </div>
          ) : (
            <div>
              <p className="font-medium text-gray-600 text-sm">Tap untuk pilih file</p>
              <p className="text-xs text-gray-400 mt-1">Bisa pilih beberapa file sekaligus · .xlsx .csv</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)} />
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="card mb-4 space-y-1.5">
          {totalCreated > 0 && (
            <p className="font-semibold text-green-700 text-sm mb-2">✅ Total {totalCreated} transaksi berhasil diimport</p>
          )}
          {results.map((r, i) => (
            <div key={i} className={`flex items-center justify-between text-xs p-2.5 rounded-lg ${r.error ? 'bg-red-50' : 'bg-green-50'}`}>
              <span className="text-gray-600 truncate max-w-[55%] text-[11px]">{r.name}</span>
              {r.error
                ? <span className="text-red-600 font-medium">❌ {r.error}</span>
                : <span className="text-right">
                    <span className="text-green-700 font-semibold">+{r.created}</span>
                    {r.skipped > 0 && <span className="text-amber-600 ml-1">({r.skipped} duplikat)</span>}
                  </span>}
            </div>
          ))}
          {loading && results.length < files.length && (
            <p className="text-xs text-gray-400 text-center pt-1">Mengimport {results.length}/{files.length}...</p>
          )}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={files.length === 0 || loading}
        className="w-full py-3 px-6 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl transition-colors">
        {loading
          ? `⏳ Mengimport ${results.length}/${files.length}...`
          : `📥 Import ${files.length > 0 ? files.length + ' File' : 'Sekarang'}`}
      </button>

      {results.length > 0 && totalCreated > 0 && !loading && (
        <button onClick={() => router.push('/orders')} className="w-full mt-3 text-sm text-amber-600 underline py-2">
          Lihat data pesanan →
        </button>
      )}
    </div>
  );
}
