'use client'

import { useEffect, useState } from 'react'

import { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'

export function useAuthCheck() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const isAuthDisabled =
      process.env.NEXT_PUBLIC_ENABLE_AUTH === 'false' ||
      process.env.ENABLE_AUTH === 'false'
    const supabaseConfigured =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const checkAuth = async () => {
      // Allow anonymous mode when auth is disabled or Supabase is not configured
      if (isAuthDisabled || !supabaseConfigured) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()

        const {
          data: { session }
        } = await supabase.auth.getSession()
        setUser(session?.user ?? null)

        // Subscribe to auth changes
        const {
          data: { subscription: authSubscription }
        } = supabase.auth.onAuthStateChange((event, session) => {
          setUser(session?.user ?? null)
        })
        subscription = authSubscription
      } catch (error) {
        // Supabase not configured
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const isAuthDisabled =
    process.env.NEXT_PUBLIC_ENABLE_AUTH === 'false' ||
    process.env.ENABLE_AUTH === 'false'
  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return {
    user,
    loading,
    isAuthenticated: isAuthDisabled || !supabaseConfigured || !!user
  }
}
