import Sidebar from '@/components/Sidebar';
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 overflow-auto pb-20 md:pb-8">{children}</main>
    </div>
  );
}
