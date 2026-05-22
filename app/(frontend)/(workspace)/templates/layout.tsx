export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-m-3 flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden sm:-m-4 md:-m-5">
      {children}
    </div>
  );
}
