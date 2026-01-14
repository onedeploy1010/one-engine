export const metadata = {
  title: 'ONE Engine API',
  description: 'Unified backend API for the ONE ecosystem',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
