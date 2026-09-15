import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      const safePath = next.startsWith('/') && !next.startsWith('//') ? next : '/';

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${safePath}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${safePath}`);
      } else {
        return NextResponse.redirect(`${origin}${safePath}`);
      }
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=Could not authenticate session. The link may have expired.`
  );
}
