import React from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/format';
import { User, Mail, Calendar, Shield, KeyRound } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id || '')
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Account Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          View your personal profile and account credentials.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal Information</CardTitle>
          <CardDescription>Your registered account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Display Name</p>
              <p className="text-sm font-semibold text-foreground">
                {profile?.display_name || user?.user_metadata?.display_name || 'Not set'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Email Address</p>
              <p className="text-sm font-semibold text-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Account Role</p>
              <div className="mt-0.5">
                <Badge variant={profile?.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                  {profile?.role || 'Customer'}
                </Badge>
              </div>
            </div>
          </div>

          {user?.created_at && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Member Since</p>
                <p className="text-sm font-semibold text-foreground">
                  {formatDate(user.created_at)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Security & Credentials
          </CardTitle>
          <CardDescription>Manage your account password</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Password</p>
            <p className="text-xs text-muted-foreground">
              Update your account password anytime to keep your account secure.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/account/reset-password">Change Password</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
