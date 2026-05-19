export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-m-6 flex h-[calc(100vh)] max-h-[calc(100vh)] flex-col overflow-hidden">
      {children}
    </div>
  );
}
