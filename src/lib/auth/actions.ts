'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  signInSchema,
  signUpSchema,
  resetPasswordSchema,
  type SignInInput,
  type SignUpInput,
  type ResetPasswordInput,
} from '@/lib/validation';

export interface AuthActionResult {
  success?: boolean;
  error?: string;
  message?: string;
}

function parseInputData(
  firstArg: AuthActionResult | FormData | Record<string, unknown> | null,
  secondArg?: FormData
): Record<string, unknown> {
  if (secondArg instanceof FormData) {
    const data: Record<string, unknown> = {};
    secondArg.forEach((value, key) => {
      data[key] = value;
    });
    return data;
  }

  if (firstArg instanceof FormData) {
    const data: Record<string, unknown> = {};
    firstArg.forEach((value, key) => {
      data[key] = value;
    });
    return data;
  }

  if (firstArg && typeof firstArg === 'object') {
    return firstArg as Record<string, unknown>;
  }

  return {};
}

/**
 * Server action for email/password sign-in.
 * Supports useActionState, form action, and direct invocation.
 */
export async function signIn(
  prevStateOrData: AuthActionResult | FormData | SignInInput | null,
  formData?: FormData
): Promise<AuthActionResult> {
  const data = parseInputData(prevStateOrData, formData);
  const validation = signInSchema.safeParse({
    email: data.email,
    password: data.password,
  });

  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || 'Invalid form input',
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: validation.data.email,
    password: validation.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  const next = typeof data.next === 'string' && data.next.startsWith('/') && !data.next.startsWith('//')
    ? data.next
    : '/';

  revalidatePath('/', 'layout');
  redirect(next);
}

/**
 * Server action for customer registration.
 * Stores display_name in user metadata, which triggers profile creation.
 */
export async function signUp(
  prevStateOrData: AuthActionResult | FormData | SignUpInput | null,
  formData?: FormData
): Promise<AuthActionResult> {
  const data = parseInputData(prevStateOrData, formData);
  const validation = signUpSchema.safeParse({
    email: data.email,
    password: data.password,
    display_name: data.display_name,
  });

  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || 'Invalid form input',
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData, error } = await supabase.auth.signUp({
    email: validation.data.email,
    password: validation.data.password,
    options: {
      data: {
        display_name: validation.data.display_name,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Detect duplicate user when email confirmation is enabled
  if (
    authData.user &&
    !authData.session &&
    authData.user.identities &&
    authData.user.identities.length === 0
  ) {
    return { error: 'An account with this email address already exists.' };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * Server action for password reset request.
 */
export async function resetPassword(
  prevStateOrData: AuthActionResult | FormData | ResetPasswordInput | null,
  formData?: FormData
): Promise<AuthActionResult> {
  const data = parseInputData(prevStateOrData, formData);
  const validation = resetPasswordSchema.safeParse({
    email: data.email,
  });

  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || 'Invalid email address',
    };
  }

  const supabase = await createServerSupabaseClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const { error } = await supabase.auth.resetPasswordForEmail(validation.data.email, {
    redirectTo: `${siteUrl}/callback?next=/account/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: 'If an account exists with this email, a password reset link has been sent.',
  };
}

/**
 * Server action to sign out the current user.
 */
export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
