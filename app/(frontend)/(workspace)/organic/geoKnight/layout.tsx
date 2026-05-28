export default function GeoKnightLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-m-3 sm:-m-4 md:-m-5 flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto glass-scrollbar">
      {children}
    </div>
  );
}
