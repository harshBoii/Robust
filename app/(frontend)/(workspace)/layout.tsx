import { getSession } from '@/lib/auth/session';
import { getCompanyLogoUrl } from '@/lib/profile/company-logo';
import SideBar from '@/app/components/sideBar/SideBar';
import ToastProvider from '@/app/components/UI/ToastProvider';
import { ModalRoot } from '@/app/components/common/ModalRoot';

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const logoUrl = session ? await getCompanyLogoUrl(session.companyId) : null;

  return (
    <ToastProvider>
      <div className="relative flex h-screen w-full overflow-hidden bg-background text-foreground">
        {/* Sidebar above in-flow main content; modals mount in ModalRoot (same layer, above both). */}
        <div className="relative z-sidebar flex shrink-0">
          <SideBar
            companyId={session?.companyId ?? ''}
            displayName={session?.userName ?? undefined}
            logoUrl={logoUrl}
          />
        </div>
        <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-full min-h-0 flex-1 flex-col p-3 sm:p-4 md:p-5">{children}</div>
        </main>
        <ModalRoot />
      </div>
    </ToastProvider>
  );
}

