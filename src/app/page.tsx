'use client';

import { createClient } from '../utils/supabase/client';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      }
      setLoading(false);
    };
    checkUser();
  }, [router, supabase.auth]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-gray-950 text-white font-sans">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Checking Authorization...</p>
      </div>
    </div>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-24 text-white">
      <div className="z-10 w-full max-w-md items-center justify-between font-mono text-sm lg:flex-col gap-8">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-3xl bg-indigo-600 flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/20 rotate-3">
             <span className="text-3xl font-black">D</span>
          </div>
          <h1 className="text-4xl font-black mb-2 text-center uppercase tracking-tighter italic">Dad Strength</h1>
          <p className="text-gray-500 text-center font-medium">
            The Operating System for Modern Fatherhood.
          </p>
        </div>

        <div className="bg-gray-900 p-8 rounded-3xl shadow-2xl border border-gray-800 w-full">
          <Auth
            supabaseClient={supabase}
            appearance={{ 
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#4f46e5',
                    brandAccent: '#4338ca',
                  },
                },
              },
            }}
            theme="dark"
            providers={['google']}
            redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined}
          />
        </div>

        <p className="text-[10px] text-gray-600 uppercase font-black tracking-[0.3em] mt-12">
          Forge OS // Dad Strength v2.0
        </p>
      </div>
    </div>
  );
}
