import { useEffect, useState } from 'react';
import Head from 'next/head';
import { AppShell } from '@/components/layout/app-shell';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="size-5 rounded-full border-2 border-[#0275E2] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Locapi - Desktop API Client</title>
      </Head>
      <AppShell />
    </>
  );
}
