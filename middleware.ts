// ============================================================
// PRAAV — Middleware
// src/middleware.ts
// ============================================================
// Runs on every request to:
//   1. Refresh the Supabase session (keeps JWT fresh)
//   2. Protect authenticated routes
//   3. Redirect logged-in users away from auth pages

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

// Routes that require a logged-in session
const PROTECTED_ROUTES = [
  '/discover',
  '/matches',
  '/chat',
  '/profile',
  '/profile-builder',
  '/settings',
]

// Routes that logged-in users should not see
const AUTH_ROUTES = ['/login', '/signup', '/verify']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not add any logic between createServerClient and getUser().
  // A simple mistake here could make session refresh unreliable.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Redirect unauthenticated users away from protected routes
  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r))
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  const isAuthRoute = AUTH_ROUTES.some(r => pathname.startsWith(r))
  if (isAuthRoute && user) {
    const appUrl = request.nextUrl.clone()
    appUrl.pathname = '/discover'
    return NextResponse.redirect(appUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
