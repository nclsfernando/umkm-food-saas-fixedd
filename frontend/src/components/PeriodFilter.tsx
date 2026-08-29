'use client';

import { formatPeriodLabel } from '@/lib/period';

type Props = {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onApply?: () => void;
  applying?: boolean;
  applyLabel?: string;
};

export default function PeriodFilter({
  from,
  to,
  onFromChange,
  onToChange,
  onApply,
  applying,
  applyLabel = 'Tampilkan',
}: Props) {
  return (
    <div className="card">
      <p className="text-sm font-medium text-gray-800 mb-3">{formatPeriodLabel(from, to)}</p>
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Dari Tanggal</label>
          <input
            type="date"
            className="input w-auto"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Sampai Tanggal</label>
          <input
            type="date"
            className="input w-auto"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
          />
        </div>
        {onApply && (
          <button onClick={onApply} disabled={applying} className="btn-primary">
            {applying ? 'Memuat...' : applyLabel}
          </button>
        )}
      </div>
    </div>
  );
}
