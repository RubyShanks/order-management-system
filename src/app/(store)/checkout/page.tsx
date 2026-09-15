import React from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CheckoutClient } from './CheckoutClient';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/checkout');
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:py-12 max-w-5xl">
      <CheckoutClient userEmail={user.email || ''} />
    </div>
  );
}
