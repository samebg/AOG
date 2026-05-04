'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EMOTIONS } from '@/lib/emotions'
import { getLevelFromXP, getUnlockedColors, XP_REWARDS } from '@/lib/xp'
import { useRouter } from 'next/navigation'

interface Profile {
  total_xp: number
  current_level: number
  streak_count: number
  display_name: string | null
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [selectedEmotion, setSelectedEmotion] = useState(EMOTIONS[0])
  const [verse, setVerse] = useState<{ text: string; reference: string } | null>(null)
  const [verseLoading, setVerseLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [crisis, setCrisis] = useState(false)
  const [highlightColor, setHighlightColor] = useState('#FBBF24')
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'home' | 'chat' | 'journey'>('home')
  const supabase = createClient()
  const router = useRouter()

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('profiles')
      .select('total_xp, current_level, streak_count, display_name')
      .eq('id', user.id)
      .single()

    if (data) setProfile(data)

    await fetch('/api/streak', { method: 'POST' })
    const { data: updated } = await supabase
      .from('profiles')
      .select('total_xp, current_level, streak_count, display_name')
      .eq('id', user.id)
      .single()
    if (updated) setProfile(updated)
  }, [supabase, router])

  const fetchVerse = useCallback(async (verseId: string) => {
    setVerseLoading(true)
    setVerse(null)
    try {
      const res = await fetch(`/api/bible/verse?verseId=${verseId}`)
      const data = await res.json()
      if (data.data) {
        setVerse({
          text: data.data.content.replace(/<[^>]*>/g, '').trim(),
          reference: data.data.reference
        })
      }
    } catch { 
      setVerse({ text: 'Could not load verse.', reference: '' }) 
    }
    setVerseLoading(false)
  }, [])

  useEffect(() => { loadProfile() }, [loadProfile])
  useEffect(() => { fetchVerse(selectedEmotion.verseId) }, [selectedEmotion, fetchVerse])

  async function handleEmotionSelect(emotion: typeof EMOTIONS[0]) {
    setSelectedEmotion(emotion)
    await fetch('/api/xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        amount: XP_REWARDS.EMOTION_CHECKIN, 
        reason: 'emotion_checkin' 
      })
    })
  }

  async function handleSendMessage() {
    if (!input.trim() || chatLoading) return
    const userMessage: Message = { role: 'user', content: input }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setChatLoading(true)
    setCrisis(false)

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages })
    })
    const data = await res.json()
    
    if (data.crisis) setCrisis(true)
    setMessages([...newMessages, { 
      role: 'assistant', 
      content: data.response || data.error 
    }])
    
    if (!data.crisis && newMessages.length === 1) {
      await fetch('/api/xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: XP_REWARDS.CHAT_SESSION, 
          reason: 'chat_session' 
        })
      })
    }
    setChatLoading(false)
  }

  async function handleHighlight() {
    if (!verse) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('highlights').insert({
      user_id: user.id,
      verse_id: selectedEmotion.verseId,
      verse_reference: verse.reference,
      verse_text: verse.text,
      color: highlightColor,
    })

    await fetch('/api/xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        amount: XP_REWARDS.HIGHLIGHT_VERSE, 
        reason: 'highlight_verse' 
      })
    })

    setSaveSuccess(true)
    setShowHighlightPicker(false)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const levelInfo = profile ? getLevelFromXP(profile.total_xp) : null
  const unlockedColors = profile 
    ? getUnlockedColors(profile.current_level) : []

  return (
    <div className="min-h-screen bg-stone-950 text-white max-w-lg mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <div>
          <h1 className="text-base font-medium">
            {profile?.display_name 
              ? `Welcome, ${profile.display_name}` 
              : 'Armor of God'}
          </h1>
          {profile && (
            <p className="text-stone-500 text-xs mt-0.5">
              {profile.streak_count} day streak
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {levelInfo && (
            <div className="flex items-center gap-2 bg-stone-900 
                            rounded-full px-3 py-1.5 border border-stone-800">
              <span className="text-violet-400 text-xs font-medium">
                Lv {levelInfo.current.level}
              </span>
              <div className="w-16 h-1 bg-stone-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-700"
                  style={{ width: `${levelInfo.progress}%` }}
                />
              </div>
              <span className="text-stone-500 text-xs">
                {profile?.total_xp} xp
              </span>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-800 px-5 mb-5">
        {(['home', 'chat', 'journey'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 mr-6 text-sm capitalize transition-colors border-b-2 -mb-px
              ${activeTab === tab 
                ? 'text-white border-violet-500' 
                : 'text-stone-500 border-transparent hover:text-stone-300'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* HOME TAB */}
      {activeTab === 'home' && (
        <div className="px-5 pb-24">

          {/* Daily image placeholder */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl 
                          p-6 mb-6 text-center">
            <div className="text-3xl mb-2">🛡️</div>
            <p className="text-xs text-stone-400 italic mb-1">
              "Put on the full armor of God, so that you can take your 
              stand against the devil's schemes."
            </p>
            <p className="text-xs text-stone-600">Ephesians 6:11</p>
          </div>

          {/* Emotion selector */}
          <p className="text-stone-400 text-sm mb-3">
            How are you feeling today?
          </p>
          <div className="grid grid-cols-4 gap-2 mb-6">
            {EMOTIONS.map(emotion => (
              <button
                key={emotion.id}
                onClick={() => handleEmotionSelect(emotion)}
                className={`flex flex-col items-center gap-1.5 rounded-xl p-3 
                            border transition-all text-center
                  ${selectedEmotion.id === emotion.id
                    ? 'bg-stone-800 border-violet-500'
                    : 'bg-stone-900 border-stone-800 hover:border-stone-600'}`}
              >
                <span className="text-xl">{emotion.emoji}</span>
                <span className="text-xs text-stone-400 leading-tight">
                  {emotion.label}
                </span>
              </button>
            ))}
          </div>

          {/* Verse card */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-stone-500">
                For when you feel {selectedEmotion.label.toLowerCase()}
              </span>
              <span 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ background: selectedEmotion.color }}
              />
            </div>

            {verseLoading && (
              <div className="animate-pulse">
                <div className="h-3 bg-stone-800 rounded mb-2 w-full" />
                <div className="h-3 bg-stone-800 rounded mb-2 w-4/5" />
                <div className="h-3 bg-stone-800 rounded w-3/5" />
              </div>
            )}

            {verse && !verseLoading && (
              <>
                <p className="text-stone-200 text-sm leading-relaxed italic mb-1">
                  "{verse.text}"
                </p>
                <p className="text-stone-500 text-xs mb-4">{verse.reference}</p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowHighlightPicker(!showHighlightPicker)}
                    className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 
                               rounded-xl py-2 text-xs transition-colors border 
                               border-stone-700"
                  >
                    Highlight
                  </button>
                  <button
                    onClick={() => setActiveTab('chat')}
                    className="flex-1 bg-violet-600 hover:bg-violet-500 text-white 
                               rounded-xl py-2 text-xs transition-colors"
                  >
                    Talk about this
                  </button>
                </div>

                {showHighlightPicker && (
                  <div className="mt-3 p-3 bg-stone-800 rounded-xl border 
                                  border-stone-700">
                    <p className="text-xs text-stone-400 mb-2">
                      Choose a highlight color
                    </p>
                    <div className="flex gap-2 flex-wrap mb-3">
                      {unlockedColors.map(c => (
                        <button
                          key={c.hex}
                          onClick={() => setHighlightColor(c.hex)}
                          className={`w-7 h-7 rounded-full border-2 transition-all
                            ${highlightColor === c.hex 
                              ? 'border-white scale-110' 
                              : 'border-transparent'}`}
                          style={{ background: c.hex }}
                          title={c.name}
                        />
                      ))}
                    </div>
                    <button
                      onClick={handleHighlight}
                      className="w-full bg-violet-600 hover:bg-violet-500 text-white 
                                 rounded-lg py-2 text-xs transition-colors"
                    >
                      Save to highlights
                    </button>
                  </div>
                )}

                {saveSuccess && (
                  <p className="text-emerald-400 text-xs text-center mt-2">
                    Saved! +{XP_REWARDS.HIGHLIGHT_VERSE} XP
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* CHAT TAB */}
      {activeTab === 'chat' && (
        <div className="px-5 pb-24 flex flex-col h-[calc(100vh-160px)]">
          <div className="flex-1 overflow-y-auto space-y-3 mb-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="text-3xl mb-3">✝️</div>
                <p className="text-stone-400 text-sm">
                  Share what's on your heart.
                </p>
                <p className="text-stone-600 text-xs mt-1">
                  Scripture-grounded encouragement awaits.
                </p>
              </div>
            )}

            {crisis && (
              <div className="bg-red-950 border border-red-800 rounded-2xl p-4">
                <p className="text-red-300 text-xs font-medium mb-1">
                  You are not alone
                </p>
                <p className="text-red-200 text-sm">
                  Please reach out to the 988 Suicide & Crisis Lifeline — 
                  call or text <strong>988</strong>
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs rounded-2xl px-4 py-3 text-sm leading-relaxed
                    ${m.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-sm'
                      : 'bg-stone-900 border border-stone-800 text-stone-200 rounded-bl-sm'}`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-stone-900 border border-stone-800 rounded-2xl 
                                rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-stone-600 rounded-full 
                                    animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-stone-600 rounded-full 
                                    animate-bounce delay-100" />
                    <div className="w-1.5 h-1.5 bg-stone-600 rounded-full 
                                    animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              placeholder="Share what's on your heart..."
              className="flex-1 bg-stone-900 border border-stone-800 text-white 
                         rounded-xl px-4 py-3 text-sm outline-none 
                         focus:border-violet-500 transition-colors placeholder-stone-600"
            />
            <button
              onClick={handleSendMessage}
              disabled={chatLoading || !input.trim()}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 
                         text-white rounded-xl px-4 py-3 text-sm transition-colors"
            >
              Send
            </button>
          </div>
          <p className="text-stone-700 text-xs text-center mt-2">
            For spiritual encouragement only. Not a substitute for professional help.
          </p>
        </div>
      )}

      {/* JOURNEY TAB */}
      {activeTab === 'journey' && levelInfo && (
        <div className="px-5 pb-24">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 mb-4">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-violet-950 border-2 border-violet-600 
                              rounded-full flex items-center justify-center 
                              mx-auto mb-3">
                <span className="text-2xl font-medium text-violet-300">
                  {levelInfo.current.level}
                </span>
              </div>
              <h2 className="text-base font-medium">
                {levelInfo.current.name}
              </h2>
              <p className="text-stone-500 text-xs mt-1">
                {profile?.total_xp} total XP · {profile?.streak_count} day streak
              </p>
            </div>
            {levelInfo.nextLevel && (
              <>
                <div className="flex justify-between text-xs text-stone-500 mb-1.5">
                  <span>{profile?.total_xp} xp</span>
                  <span>{levelInfo.nextLevel.xpRequired} xp to {levelInfo.nextLevel.name}</span>
                </div>
                <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-700"
                    style={{ width: `${levelInfo.progress}%` }}
                  />
                </div>
              </>
            )}
          </div>

          <p className="text-stone-500 text-xs mb-3 uppercase tracking-wider">
            Highlight colors
          </p>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {[...Array(6)].map((_, i) => {
              const colors = [
                { name: 'Gold', hex: '#FBBF24', req: 1 },
                { name: 'Emerald', hex: '#34D399', req: 2 },
                { name: 'Violet', hex: '#818CF8', req: 3 },
                { name: 'Ember', hex: '#FB923C', req: 4 },
                { name: 'Crimson', hex: '#F87171', req: 5 },
                { name: 'Sapphire', hex: '#38BDF8', req: 7 },
              ]
              const c = colors[i]
              const unlocked = (profile?.current_level || 1) >= c.req
              return (
                <div
                  key={c.name}
                  className={`flex items-center gap-3 bg-stone-900 border 
                              rounded-xl p-3 border-stone-800
                    ${!unlocked ? 'opacity-40' : ''}`}
                >
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0"
                    style={{ background: unlocked ? c.hex : '#44403c' }}
                  />
                  <div>
                    <p className="text-sm text-stone-200">{c.name}</p>
                    <p className="text-xs text-stone-500">
                      {unlocked ? 'Unlocked' : `Level ${c.req}`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-stone-500 text-xs mb-3 uppercase tracking-wider">
            How to earn XP
          </p>
          <div className="space-y-2">
            {[
              ['Open app each day', '+50 xp'],
              ['Select your emotion', '+10 xp'],
              ['Highlight a verse', '+15 xp'],
              ['Start a chat session', '+25 xp'],
            ].map(([label, xp]) => (
              <div
                key={label}
                className="flex justify-between items-center bg-stone-900 
                           border border-stone-800 rounded-xl px-4 py-3"
              >
                <span className="text-sm text-stone-300">{label}</span>
                <span className="text-sm text-violet-400 font-medium">{xp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}