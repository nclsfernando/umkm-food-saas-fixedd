import { NextRequest, NextResponse } from 'next/server';
import { HttpError, importFile } from '@/lib/server/import-service';
import { requireDatabaseOr503 } from '@/lib/server/db-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { message: 'File tidak ditemukan. Pastikan field form bernama "file".' },
        { status: 400 },
      );
    }
    const ab = await file.arrayBuffer();
    const buffer = Buffer.from(ab);
    if (!buffer.length) {
      return NextResponse.json({ message: 'File kosong atau gagal diunggah.' }, { status: 400 });
    }
    const result = await importFile(buffer, file.name || 'upload.csv');
    return NextResponse.json(result);
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (/DATABASE_URL|Can't reach database|P1001|P1012/i.test(msg)) {
      return NextResponse.json(
        {
          message:
            'Tidak bisa terhubung ke database. Periksa DATABASE_URL di Vercel (harus URL publik, bukan *.railway.internal) lalu Redeploy.',
        },
        { status: 503 },
      );
    }
    const status = err instanceof HttpError ? err.status : 500;
    const message = err?.message || 'Import gagal';
    return NextResponse.json({ message }, { status });
  }
}
