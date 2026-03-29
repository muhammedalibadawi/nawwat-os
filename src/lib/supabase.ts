import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Guard: fail loudly during development if env vars are missing.
// This surfaces a clear error instead of a silent infinite hang.
if (!supabaseUrl || !supabaseAnonKey) {
    const msg =
        '[NawwatOS] CRITICAL: Supabase environment variables are missing!\n\n' +
        'Create a file at .env with:\n' +
        '  VITE_SUPABASE_URL=https://your-project-id.supabase.co\n' +
        '  VITE_SUPABASE_ANON_KEY=your-anon-key\n\n' +
        'Find these values at: https://supabase.com → Project Settings → API'
    console.error(msg)
    // In dev mode, show an alert so it's impossible to miss
    if (import.meta.env.DEV) {
        alert(msg)
    }
    throw new Error(msg)
}

export const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
        auth: {
            // CRITICAL FIX: Bypass navigator.locks to prevent Vite HMR / Headless Chrome deadlocks
            // that cause the "Lock was not released within 5000ms" infinite spinner on login.
            lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => await fn(),
            autoRefreshToken: true,
            persistSession: true
        }
    }
)
