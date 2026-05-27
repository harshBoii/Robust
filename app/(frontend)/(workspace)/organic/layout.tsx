export default function OrganicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto glass-scrollbar">
      {children}
    </div>
  );
}
