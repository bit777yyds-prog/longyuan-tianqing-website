import type { Metadata } from 'next';
import '@/design-system/globals.css';

export const metadata: Metadata = {
  title: '龙渊天青',
  description: '从青瓷出发，连接文学、历史、神话与当代数字文化。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
