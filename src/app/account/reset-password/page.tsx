'use client';

import React, { useActionState } from 'react';
import Link from 'next/link';
import { updatePassword, type AuthActionResult } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Loader2, KeyRound } from 'lucide-react';

export default function UpdatePasswordPage() {
  const [state, formAction, isPending] = useActionState<AuthActionResult | null, FormData>(
    updatePassword,
    null
  );

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Set New Password
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your new password below to secure your account.
        </p>
      </div>

      <Card className="shadow-xs">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Update Password
          </CardTitle>
          <CardDescription>
            Password must be at least 8 characters long
          </CardDescription>
        </CardHeader>

        <form action={formAction}>
          <CardContent className="space-y-4">
            {state?.error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            {state?.success && (
              <Alert className="border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300">
                <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
                <AlertDescription>
                  {state.message}{' '}
                  <Link
                    href="/account/profile"
                    className="font-semibold underline underline-offset-4 hover:opacity-80"
                  >
                    Go to Profile
                  </Link>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="New password"
                required
                minLength={8}
                autoComplete="new-password"
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                placeholder="Confirm password"
                required
                minLength={8}
                autoComplete="new-password"
                disabled={isPending}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                'Save New Password'
              )}
            </Button>

            <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
              <Link href="/account/profile">Back to Profile</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}