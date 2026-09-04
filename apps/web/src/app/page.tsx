'use client';

import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RootPage() {
  const { data: user, isLoading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? '/dashboard' : '/login');
  }, [user, isLoading, router]);

  return null; // brief flash before redirect fires
}