import SideBar from '@/app/components/sideBar/SideBar';

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <SideBar />
      <main className="flex flex-1 flex-col">
        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  );
}

