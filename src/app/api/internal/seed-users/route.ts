import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secretKey = request.headers.get('x-seed-secret');

  const isAuthorized =
    (process.env.RECOVERY_API_KEY && authHeader === `Bearer ${process.env.RECOVERY_API_KEY}`) ||
    secretKey === 'seed_oms_users_2026';

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const results: Record<string, unknown>[] = [];

  // 1. Customer user
  const customerEmail = 'customer@oms-test.com';
  const customerPassword = 'Password123!';

  const { data: custData, error: custError } = await adminClient.auth.admin.createUser({
    email: customerEmail,
    password: customerPassword,
    email_confirm: true,
    user_metadata: { display_name: 'Test Customer' },
  });

  if (custError && custError.message.includes('already exists')) {
    const { data: users } = await adminClient.auth.admin.listUsers();
    const existing = users.users.find((u) => u.email === customerEmail);
    if (existing) {
      await adminClient.auth.admin.updateUserById(existing.id, {
        password: customerPassword,
        email_confirm: true,
      });
      results.push({ email: customerEmail, status: 'updated_existing', id: existing.id });
    }
  } else if (custError) {
    results.push({ email: customerEmail, status: 'error', error: custError.message });
  } else {
    results.push({ email: customerEmail, status: 'created', id: custData.user?.id });
  }

  // 2. Admin user
  const adminEmail = 'admin@oms-test.com';
  const adminPassword = 'Password123!';

  const { data: adminData, error: adminError } = await adminClient.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { display_name: 'System Admin' },
  });

  let adminId = adminData?.user?.id;

  if (adminError && adminError.message.includes('already exists')) {
    const { data: users } = await adminClient.auth.admin.listUsers();
    const existing = users.users.find((u) => u.email === adminEmail);
    if (existing) {
      adminId = existing.id;
      await adminClient.auth.admin.updateUserById(existing.id, {
        password: adminPassword,
        email_confirm: true,
      });
      results.push({ email: adminEmail, status: 'updated_existing', id: existing.id });
    }
  } else if (adminError) {
    results.push({ email: adminEmail, status: 'error', error: adminError.message });
  } else {
    results.push({ email: adminEmail, status: 'created', id: adminId });
  }

  // Ensure admin role is set in profiles table
  if (adminId) {
    const { error: roleError } = await adminClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', adminId);

    results.push({
      email: adminEmail,
      action: 'promote_to_admin',
      error: roleError ? roleError.message : null,
    });
  }

  return NextResponse.json({ success: true, accounts: results });
}
