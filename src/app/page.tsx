'use client';

import { createClient } from '../utils/supabase/client';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../contexts/ThemeContext';

export default function Home() {
  const supabase = createClient();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const isDark = resolvedTheme === 'dark';

  const authColors = isDark
    ? {
        brand: '#E61A1A',
        brandAccent: '#c41515',
        inputBackground: '#141414',
        inputBorder: '#2B2B2B',
        inputText: '#F0F0F0',
        inputPlaceholder: '#555555',
        inputLabelText: '#8F8F8F',
        messageText: '#8F8F8F',
        anchorTextColor: '#E61A1A',
        dividerBackground: '#2B2B2B',
        defaultButtonBackground: '#1A1A1A',
        defaultButtonBackgroundHover: '#242424',
        defaultButtonBorder: '#2B2B2B',
        defaultButtonText: '#F0F0F0',
      }
    : {
        brand: '#E61A1A',
        brandAccent: '#c41515',
        inputBackground: '#FFFFFF',
        inputBorder: '#D2D2D7',
        inputText: '#1D1D1F',
        inputPlaceholder: '#AEAEB2',
        inputLabelText: '#6E6E73',
        messageText: '#6E6E73',
        anchorTextColor: '#E61A1A',
        dividerBackground: '#D2D2D7',
        defaultButtonBackground: '#F5F5F7',
        defaultButtonBackgroundHover: '#E8E8ED',
        defaultButtonBorder: '#D2D2D7',
        defaultButtonText: '#1D1D1F',
      };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.push('/dashboard');
      setLoading(false);
    };
    checkUser();
  }, [router, supabase.auth]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Top brand area */}
          <div className="flex flex-col items-center justify-center pt-16 pb-8 px-6">
            {/* Logo mark */}
            <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center mb-5">
              <span className="font-black text-white text-2xl" style={{ fontFamily: 'var(--font-bebas, sans-serif)', letterSpacing: '0.05em' }}>DS</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Dad Strength</h1>
            <p className="text-[13px] text-muted-foreground mt-1.5 text-center max-w-xs">
              The training OS for fathers who refuse to disappear
            </p>
          </div>

          {/* Auth form */}
          <div className="flex-1 px-6 max-w-sm mx-auto w-full">
            <div className="auth-container">
              <Auth
                supabaseClient={supabase}
                appearance={{
                  theme: ThemeSupa,
                  variables: {
                    default: {
                      colors: authColors,
                      borderWidths: { buttonBorderWidth: '1px', inputBorderWidth: '1px' },
                      radii: {
                        borderRadiusButton: '12px',
                        buttonBorderRadius: '12px',
                        inputBorderRadius: '12px',
                      },
                      fontSizes: { baseBodySize: '14px', baseLabelSize: '11px' },
                      fonts: { bodyFontFamily: 'var(--font-inter, sans-serif)' },
                      space: { inputPadding: '14px 16px', buttonPadding: '14px 16px' },
                    },
                  },
                  style: {
                    button: {
                      fontWeight: '600',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase' as const,
                      fontSize: '12px',
                    },
                    label: {
                      fontSize: '10px',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase' as const,
                      fontWeight: '600',
                    },
                    anchor: { fontWeight: '500' },
                  },
                }}
                providers={['google']}
                redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="py-8 px-6 text-center">
            <p className="text-[11px] text-muted-foreground/50">
              Your data is private and encrypted. No spam.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
