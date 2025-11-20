'use client'

import { memo, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

// Module-level flag để đảm bảo API chỉ được gọi 1 lần trong toàn bộ app lifecycle
let globalHasFetchedGreeting = false

function AgentLogoComponent() {
  const containerRef = useRef<HTMLDivElement>(null)
  const pupilsRef = useRef<HTMLDivElement[]>([])
  const blinkCleanupRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const [prompt, setPrompt] = useState('')
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const promptValueRef = useRef('')
  const isFetchingPrompt = useRef(false)
  const promptIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasStartedPromptPoll = useRef(false)
  const promptBubbleRef = useRef<HTMLDivElement | null>(null)
  const mountRef = useRef(false)
  const typingAnimationRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentWordsRef = useRef<string[]>([])
  const isDeletingRef = useRef(false)

  // Track mount to debug re-renders
  if (!mountRef.current) {
    mountRef.current = true
    console.log('AgentLogo: Initial mount')
  } else {
    console.log('AgentLogo: Re-render (unexpected)')
  }
  useEffect(() => {
    let frame = 0
    let blinkTimer: ReturnType<typeof setTimeout> | null = null

    const handlePointerMove = (event: PointerEvent) => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const dx = event.clientX - centerX
      const dy = event.clientY - centerY

      // Track pointer movement in a wider radius so the pupils ease toward outside motions.
      const interactionDiameter = Math.max(rect.width, rect.height) * 1.5
      const interactionRadius = interactionDiameter / 2
      const pupilTravel = Math.max(rect.width, rect.height) * 0.19
      const nextX = clamp(dx / interactionRadius, -1, 1) * pupilTravel
      const nextY = clamp(dy / interactionRadius, -1, 1) * pupilTravel

      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() =>
        pupilsRef.current.forEach(pupil => {
          if (!pupil) return
          // Skip React state to avoid rerenders; move pupils imperatively.
          pupil.style.transform = `translate(${nextX}px, ${nextY}px)`
        })
      )
    }

    const scheduleBlink = () => {
      const delay = 2800 + Math.random() * 3200
      blinkTimer = setTimeout(() => {
        pupilsRef.current.forEach(pupil => {
          if (!pupil) return
          pupil.classList.add('scale-y-0')
          blinkCleanupRef.current.push(
            setTimeout(() => {
              pupil.classList.remove('scale-y-0')
            }, 150)
          )
        })
        scheduleBlink()
      }, delay)
    }

    window.addEventListener('pointermove', handlePointerMove)
    scheduleBlink()
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      cancelAnimationFrame(frame)
      if (blinkTimer) clearTimeout(blinkTimer)
      blinkCleanupRef.current.forEach(clearTimeout)
      blinkCleanupRef.current = []
    }
  }, [])

  useEffect(() => {
    // Triple guard: Module-level + component-level + fetching flag
    // Đảm bảo API chỉ được gọi 1 lần duy nhất trong toàn bộ app lifecycle
    if (globalHasFetchedGreeting || hasStartedPromptPoll.current) return

    globalHasFetchedGreeting = true
    hasStartedPromptPoll.current = true

    const fetchPrompt = async () => {
      // Double guard: Tránh race condition nếu fetch được gọi nhiều lần
      if (isFetchingPrompt.current) return
      isFetchingPrompt.current = true

      console.log('AgentLogo: Fetching /api/greeting (only once)')

      try {
        const res = await fetch('/api/greeting')
        if (!res.ok) throw new Error('Failed to fetch prompt')
        const data = (await res.json()) as { prompt?: string }
        const nextPrompt = data.prompt ?? ''
        if (nextPrompt !== promptValueRef.current) {
          promptValueRef.current = nextPrompt
          setPrompt(nextPrompt)
        }
      } catch (err) {
        // Only update state if prompt actually changed to avoid unnecessary re-render
        if (promptValueRef.current !== '') {
          promptValueRef.current = ''
          setPrompt('')
        }
        console.warn('Using fallback prompt; generation failed', err)
      } finally {
        isFetchingPrompt.current = false
      }
    }

    fetchPrompt()

    promptIntervalRef.current = setInterval(fetchPrompt, 14000)

    // Cleanup: KHÔNG reset flags để đảm bảo chỉ fetch 1 lần
    // Chỉ cleanup interval nếu có
    return () => {
      if (promptIntervalRef.current) {
        clearInterval(promptIntervalRef.current)
        promptIntervalRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!promptBubbleRef.current) return

    const bubbleEl = promptBubbleRef.current

    if (!prompt) {
      // Fade out và ẩn bubble khi không có prompt
      bubbleEl.dataset.visible = 'false'
      // Clear typing animation
      if (typingAnimationRef.current) {
        clearTimeout(typingAnimationRef.current)
        typingAnimationRef.current = null
      }
      setDisplayedText('')
      setIsTyping(false)
      currentWordsRef.current = []
      return
    }

    // Show bubble
    bubbleEl.dataset.visible = 'true'

    // Clear existing animation
    if (typingAnimationRef.current) {
      clearTimeout(typingAnimationRef.current)
      typingAnimationRef.current = null
    }

    // Split prompt into words
    const newWords = prompt.trim().split(/\s+/).filter(Boolean)
    const oldWords = currentWordsRef.current

    // If same text, no animation needed
    if (newWords.join(' ') === oldWords.join(' ')) {
      setDisplayedText(prompt)
      setIsTyping(false)
      currentWordsRef.current = newWords
      return
    }

    // Start animation: delete old words first, then type new words
    isDeletingRef.current = true
    setIsTyping(true)
    let currentIndex = oldWords.length

    const deleteWord = () => {
      if (currentIndex > 0) {
        currentIndex--
        const remainingWords = oldWords.slice(0, currentIndex)
        setDisplayedText(remainingWords.join(' '))
        typingAnimationRef.current = setTimeout(deleteWord, 80) // Speed: 80ms per word
      } else {
        // Finished deleting, start typing new words
        isDeletingRef.current = false
        currentIndex = 0
        setDisplayedText('')
        typeWord()
      }
    }

    const typeWord = () => {
      if (currentIndex < newWords.length) {
        const wordsToShow = newWords.slice(0, currentIndex + 1)
        setDisplayedText(wordsToShow.join(' '))
        currentIndex++
        typingAnimationRef.current = setTimeout(typeWord, 100) // Speed: 100ms per word
      } else {
        // Finished typing
        currentWordsRef.current = newWords
        setIsTyping(false)
        typingAnimationRef.current = null
      }
    }

    // Start deleting if there are old words, otherwise start typing
    if (oldWords.length > 0) {
      deleteWord()
    } else {
      isDeletingRef.current = false
      typeWord()
    }

    return () => {
      if (typingAnimationRef.current) {
        clearTimeout(typingAnimationRef.current)
        typingAnimationRef.current = null
      }
    }
  }, [prompt])

  return (
    <div className={cn('flex flex-col items-center gap-5')}>
      {/* Reserve space để tránh layout shift - luôn render bubble container */}
      <div
        ref={promptBubbleRef}
        data-visible="false"
        className={cn(
          'relative max-w-md rounded-2xl border border-white/20 bg-black/70 px-3 py-3 text-center text-base text-slate-100 shadow-xl backdrop-blur',
          'origin-bottom transition-all duration-300 ease-out motion-reduce:transition-none',
          'min-h-[3rem] flex items-center justify-center', // Reserve space để tránh layout shift
          "data-[visible='true']:translate-y-0 data-[visible='true']:opacity-100 data-[visible='true']:pointer-events-auto",
          "data-[visible='false']:translate-y-2 data-[visible='false']:opacity-0 data-[visible='false']:pointer-events-none"
        )}
      >
        <div
          className={cn(
            'absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 h-4 w-4 rotate-45 border-b border-r border-white/20 bg-black/70 transition-opacity duration-300',
            prompt ? 'opacity-100' : 'opacity-0'
          )}
        />
        <span data-prompt-text>
          {displayedText || '\u00A0'}
          {/* Non-breaking space để giữ chiều cao khi không có prompt */}
          {isTyping && (
            <span className="inline-block w-0.5 h-4 bg-slate-100 ml-1 animate-pulse" />
          )}
        </span>
      </div>
      <div
        ref={containerRef}
        className={cn(
          'relative flex h-20 w-20 items-center justify-center',
          'rounded-full'
        )}
      >
        <div
          className={cn(
            'relative flex h-16 w-16 items-center justify-center',
            'rounded-full bg-gray-600 text-white shadow-[0_10px_24px_rgba(0,0,0,0.35)]'
          )}
        >
          <div className="absolute inset-0 rounded-full bg-black/70" />
          <div className="relative flex items-center justify-center gap-[1px]">
            {[0, 1].map(index => (
              <div
                key={index}
                className={cn(
                  'h-3 w-3 rounded-full bg-white transition-transform duration-600 ease-out',
                  'will-change-transform'
                )}
                ref={node => {
                  if (node) pupilsRef.current[index] = node
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export const AgentLogo = memo(AgentLogoComponent)
AgentLogo.displayName = 'AgentLogo'
