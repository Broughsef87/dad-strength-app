'use client'

import { createClient } from '../utils/supabase/client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

export default function Home() {
  const supabase = createClient()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-24 text-white">
      <div className="z-10 w-full max-w-md items-center justify-between font-mono text-sm lg:flex-col gap-8">
        <h1 className="text-4xl font-bold mb-4 text-center">Dad Strength</h1>
        <p className="text-gray-400 text-center mb-8">
          Simple, effective training for busy fathers.
        </p>

        {/* DEBUG ELEMENT */}
        <div className="bg-red-500 p-4 mb-4 text-center font-bold">
          APP IS ALIVE (v2)
        </div>

        <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700">
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            theme="dark"
            providers={['google']}
            redirectTo="http://localhost:3001/dashboard"
          />
        </div>
      </div>
    </div>
  )
}
