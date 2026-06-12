'use client'
// src/app/login/page.tsx
//
// What this file does, plain English:
// The public landing page: a feature overview on the left so visitors know
// what the app is, and the sign-in / sign-up card on the right. One form
// handles both modes via the isSignUp toggle. On success, Supabase sets the
// session cookie and we send the user to the home screen.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// The short list of what the app does, shown beside the sign-in form so visitors
// understand what Armor of God is before they create an account.
const FEATURES = [
  { icon: '💬', title: 'Scripture-grounded AI chat', desc: 'Answers drawn from a verified verse database, not made up.' },
  { icon: '🎭', title: 'Mood-based encouragement', desc: 'Tell it how you feel; get a verse that meets you there.' },
  { icon: '📖', title: 'Full Bible reader', desc: 'Read the NKJV, highlight verses, and save your favorites.' },
  { icon: '🌅', title: 'Daily AI devotionals', desc: 'A fresh reflection each day, personalized to your highlights.' },
  { icon: '⚔️', title: 'Grow as you go', desc: 'Earn XP, level up, and keep a daily streak in the Word.' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Submits the form: signs the user up or in (depending on the toggle),
  // shows Supabase's error message if it fails, and goes home if it works.
  // router.refresh() makes the server re-read the new session cookie.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-10 lg:gap-16 items-center">

        {/* Left: what this app is — the part that was missing before */}
        <div className="text-center md:text-left">
          <div className="text-5xl mb-4">🛡️</div>
          <h1 className="text-3xl md:text-4xl font-semibold text-white">Armor of God</h1>
          <p className="mt-3 text-stone-300 text-sm md:text-base leading-relaxed max-w-md mx-auto md:mx-0">
            Stand firm. Encouragement and scripture for every season — grounded in
            the Word, and personalized to you.
          </p>

          <ul className="mt-8 space-y-2 text-left max-w-md mx-auto md:mx-0">
            {FEATURES.map(f => (
              <li
                key={f.title}
                className="group flex items-start gap-3 rounded-xl border border-transparent
                           px-3 py-2.5 cursor-default transition-all duration-200
                           hover:border-stone-800 hover:bg-stone-900/50 hover:translate-x-1"
              >
                <span className="text-xl leading-none mt-0.5 transition-transform duration-200 group-hover:scale-125">
                  {f.icon}
                </span>
                <div>
                  <p className="text-sm font-medium text-stone-100 transition-colors group-hover:text-violet-200">
                    {f.title}
                  </p>
                  <p className="text-xs text-stone-400">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: the sign-in / sign-up card (logic unchanged) */}
        <div className="w-full max-w-sm mx-auto bg-stone-900/70 backdrop-blur
                        border border-stone-800 rounded-2xl p-6">
          <h2 className="text-lg font-medium text-white mb-1">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-stone-500 text-xs mb-5">
            {isSignUp ? 'Start your journey in the Word.' : 'Sign in to continue.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-stone-900 border border-stone-800 text-white 
                       rounded-xl px-4 py-3 text-sm outline-none 
                       focus:border-violet-500 transition-colors"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-stone-900 border border-stone-800 text-white 
                       rounded-xl px-4 py-3 text-sm outline-none 
                       focus:border-violet-500 transition-colors"
            required
          />
          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white 
                       rounded-xl py-3 text-sm font-medium transition-colors
                       disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-stone-500 text-sm mt-4 hover:text-stone-300 
                     transition-colors"
        >
          {isSignUp
            ? 'Already have an account? Sign in'
            : "Don't have an account? Sign up"}
        </button>
        </div>
      </div>
    </div>
  )
}