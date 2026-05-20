import { getSession } from '@/lib/auth/session';
import { getCompanyLogoUrl } from '@/lib/profile/company-logo';
import SideBar from '@/app/components/sideBar/SideBar';
import ToastProvider from '@/app/components/UI/ToastProvider';

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const logoUrl = session ? await getCompanyLogoUrl(session.companyId) : null;

  return (
    <ToastProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        {/* Stack above <main> so portaled/fixed UI from the sidebar (e.g. upload modal) is not painted under the gallery. */}
        <div className="relative z-50 flex shrink-0">
          <SideBar
            companyId={session?.companyId ?? ''}
            displayName={session?.userName ?? undefined}
            logoUrl={logoUrl}
          />
        </div>
        <main className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4 md:p-5">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}

