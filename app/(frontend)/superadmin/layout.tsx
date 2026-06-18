import { redirect } from 'next/navigation';

import { getSuperadminSession } from '@/lib/auth/superadmin-session';
import SuperadminSideBar from '@/app/components/sideBar/SuperadminSideBar';
import ToastProvider from '@/app/components/UI/ToastProvider';
import { ModalRoot } from '@/app/components/common/ModalRoot';

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSuperadminSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <ToastProvider>
      <div className="relative flex h-screen w-full overflow-hidden bg-background text-foreground">
        <div className="relative z-sidebar flex shrink-0">
          <SuperadminSideBar userName={session.userName} />
        </div>
        <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          <div className="glass-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-4 md:p-5">
            {children}
          </div>
        </main>
        <ModalRoot />
      </div>
    </ToastProvider>
  );
}
