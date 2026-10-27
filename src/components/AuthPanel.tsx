'use client';

import { createClient } from '../utils/supabase/client';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The sign-in card on the public home page. Split out of src/app/page.tsx so
 * the page itself can server-render: crawlers and link previews used to get
 * nothing but "Loading". A visitor who is already signed in sees a way into
 * the app instead of the form, so the public site stays browsable; only a
 * sign-in that happens here sends him to the dashboard.
 */
export default function AuthPanel() {
  // Memoize the client — a fresh instance each render would re-subscribe
  // the auth listener on every render and thrash the session check.
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  // New visitors get the sign-up form; only the header's "sign in" link
  // (/#sign-in) opens sign-in. "claim a founding spot" used to land on a
  // form headed sign in, which reads as "not for me" to a first-time dad.
  // A click on either link always resets the form, even when the hash is
  // already set or the visitor toggled views inside the widget, so `nonce`
  // remounts it rather than trusting `view` to have changed.
  const [view, setView] = useState<'sign_up' | 'sign_in' | 'forgotten_password'>('sign_up');
  const go = (v: typeof view) => { setView(v); setNonce((n) => n + 1); };
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (window.location.hash === '#sign-in') setView('sign_in');
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href$="#founding"], a[href$="#sign-in"]');
      if (!a) return;
      setView(a.getAttribute('href')!.endsWith('#sign-in') ? 'sign_in' : 'sign_up');
      setNonce((n) => n + 1);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // The public site is always graphite (GRAPHITE_PATHS), so the form reads
  // the site's own tokens: the volt fill for the button, recessed graphite
  // inputs, muted labels. The stock Supabase red, navy and orange are gone,
  // so the one form on the site no longer looks bolted on.
  const authAppearance = {
    theme: ThemeSupa,
    variables: {
      default: {
        colors: {
          brand: 'hsl(var(--brand))',
          brandAccent: 'hsl(var(--brand-deep))',
          brandButtonText: 'hsl(var(--brand-ink))',
          defaultButtonBackground: 'hsl(var(--surface-2))',
          defaultButtonBackgroundHover: 'hsl(var(--muted))',
          defaultButtonBorder: 'hsl(var(--border))',
          defaultButtonText: 'hsl(var(--foreground))',
          inputBackground: 'hsl(var(--surface-2))',
          inputBorder: 'hsl(var(--border))',
          inputBorderHover: 'hsl(var(--muted-foreground))',
          inputBorderFocus: 'hsl(var(--brand))',
          inputText: 'hsl(var(--foreground))',
          inputPlaceholder: 'hsl(var(--muted-foreground))',
          inputLabelText: 'hsl(var(--muted-foreground))',
          // Text and box together: the stock pale-green box under our ink
          // fell to 3.2:1. Same for errors, with the red kept to the border.
          messageText: 'hsl(var(--foreground))',
          messageBackground: 'hsl(var(--surface-2))',
          messageBorder: 'hsl(var(--border))',
          messageTextDanger: 'hsl(var(--foreground))',
          messageBackgroundDanger: 'hsl(var(--surface-2))',
          messageBorderDanger: 'hsl(var(--destructive))',
          anchorTextColor: 'hsl(var(--muted-foreground))',
          anchorTextHoverColor: 'hsl(var(--foreground))',
          dividerBackground: 'hsl(var(--border))',
        },
        fonts: {
          bodyFontFamily: 'var(--font-sans)',
          buttonFontFamily: 'var(--font-sans)',
          inputFontFamily: 'var(--font-sans)',
          labelFontFamily: 'var(--font-sans)',
        },
        radii: {
          borderRadiusButton: '999px',
          buttonBorderRadius: '999px',
          inputBorderRadius: '0.875rem',
        },
      },
    },
  };

  // The site's voice is lowercase; the widget's defaults are Title Case.
  const authLocalization = {
    variables: {
      sign_in: {
        email_label: 'email',
        password_label: 'password',
        email_input_placeholder: 'you@example.com',
        password_input_placeholder: 'your password',
        button_label: 'sign in',
        loading_button_label: 'signing in…',
        social_provider_text: 'sign in with {{provider}}',
        link_text: 'already have an account? sign in',
      },
      sign_up: {
        email_label: 'email',
        password_label: 'create a password',
        email_input_placeholder: 'you@example.com',
        password_input_placeholder: 'your password',
        button_label: 'sign up',
        loading_button_label: 'signing up…',
        social_provider_text: 'sign up with {{provider}}',
        link_text: "don't have an account? sign up",
        confirmation_text: 'check your email for the confirmation link',
      },
      forgotten_password: {
        email_label: 'email',
        password_label: 'password',
        email_input_placeholder: 'you@example.com',
        button_label: 'send reset instructions',
        loading_button_label: 'sending…',
        link_text: 'forgot your password?',
        confirmation_text: 'check your email for the reset link',
      },
    },
  };

  useEffect(() => {
    // Set once the initial check has seen no session. Supabase can emit
    // SIGNED_IN for a session it merely restored (e.g. on tab refocus), so
    // only an event after a signed-out start counts as signing in here.
    //
    // A Google sign-in comes back as /dashboard?code=…, which middleware sends
    // on to /?code=…&signin=oauth before the browser has exchanged the code.
    // The browser client can exchange the code and strip ?code= before this
    // effect runs, so the marker is what counts: Supabase deletes only `code`,
    // and only middleware adds `signin`, so a stray ?code= does not.
    const oauthReturn = new URLSearchParams(window.location.search).get('signin') === 'oauth';
    let startedSignedOut = oauthReturn;

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && oauthReturn) { router.replace('/dashboard'); return; }
      setSignedIn(!!session);
      startedSignedOut = startedSignedOut || !session;
      setLoading(false);
    };
    checkUser();

    // Live listener — THIS is what redirects after an in-place email/password
    // sign-in. Without it, a successful login updates the session but the
    // page just sits there ("nothing happens on Sign In").
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: unknown) => {
      if (session && event === 'SIGNED_IN' && startedSignedOut) {
        router.replace('/dashboard');
      }
      if (!session && event === 'SIGNED_OUT') {
        setSignedIn(false);
        startedSignedOut = true;
      }
    });
    return () => subscription.unsubscribe();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center bg-card border border-border">
        <div className="w-5 h-5 border border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (signedIn) {
    return (
      <div className="relative bg-card border border-border p-6">
        <p className="eyebrow-mono">signed in</p>
        <p className="mt-2 mb-5 text-[15px] font-light leading-[1.65] text-muted-foreground">
          you are already signed in.
        </p>
        <a href="/dashboard" className="pill-volt inline-block px-6 py-3.5 text-base font-semibold">
          open the app
        </a>
      </div>
    );
  }

  return (
    <div className="relative bg-card border border-border p-6">
      <Auth
        key={`${view}-${nonce}`}
        view={view}
        supabaseClient={supabase}
        appearance={authAppearance}
        localization={authLocalization}
        providers={['google']}
        // One redirect serves Google sign-in and the reset email, so the
        // widget's own view links are off and ours below switch the view:
        // a reset link must land on /reset-password, a sign-in on /dashboard.
        showLinks={false}
        redirectTo={typeof window !== 'undefined'
          ? `${window.location.origin}${view === 'forgotten_password' ? '/reset-password' : '/dashboard'}`
          : undefined}
      />
      <div className="mt-3 flex flex-col items-center gap-2 text-sm text-muted-foreground">
        {view === 'sign_in' && (
          <button type="button" className="underline-offset-4 hover:underline" onClick={() => go('forgotten_password')}>forgot your password?</button>
        )}
        {view === 'sign_up'
          ? <button type="button" className="underline-offset-4 hover:underline" onClick={() => go('sign_in')}>already have an account? sign in</button>
          : view === 'sign_in'
            ? <button type="button" className="underline-offset-4 hover:underline" onClick={() => go('sign_up')}>don&apos;t have an account? sign up</button>
            : <button type="button" className="underline-offset-4 hover:underline" onClick={() => go('sign_in')}>back to sign in</button>}
      </div>
    </div>
  );
}
