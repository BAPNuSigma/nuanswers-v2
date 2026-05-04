// Auth + profile check happens in chat/page.tsx (the server component).
// This layout is a passthrough so we don't double-query the database
// on every chat page load.
export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
