'use client'

import { TextGenerateEffect } from '@/components/ui/text-generate-effect'
import { cn } from '@/lib/utils'
import { motion } from 'motion/react'
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function AgentLogoComponent() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [prompt, setPrompt] = useState('')
  const promptValueRef = useRef('')
  const isFetchingPrompt = useRef(false)
  const promptIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasStartedPromptPoll = useRef(false)
  const promptBubbleRef = useRef<HTMLDivElement | null>(null)
  const measureRef = useRef<HTMLDivElement | null>(null)
  const mountRef = useRef(false)
  const [bubbleWidth, setBubbleWidth] = useState<number>(164) // 140 + 24px padding
  const [bubbleHeight, setBubbleHeight] = useState<number>(48) // min-height
  const [showPrompt, setShowPrompt] = useState(false)
  const [pupilPositions, setPupilPositions] = useState({ x: 0, y: 0 })
  const [isBlinking, setIsBlinking] = useState(false)
  const pupilStrength = 1.1 // Tăng sức mạnh animation của pupil

  useEffect(() => {
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
      const pupilTravelX = Math.max(rect.width, rect.height) * 0.23
      const pupilTravelY = Math.max(rect.width, rect.height) * 0.1
      const nextX =
        clamp(dx / interactionRadius, -1, 1) * pupilTravelX * pupilStrength
      const nextY =
        clamp(dy / interactionRadius, -1, 1) * pupilTravelY * pupilStrength

      // Update state for motion/react animation
      setPupilPositions({ x: nextX, y: nextY })
    }

    const scheduleBlink = () => {
      const delay = 2800 + Math.random() * 3200
      blinkTimer = setTimeout(() => {
        setIsBlinking(true)
        // Reset blink after animation duration
        setTimeout(() => setIsBlinking(false), 150)
        scheduleBlink()
      }, delay)
    }

    window.addEventListener('pointermove', handlePointerMove)
    scheduleBlink()
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      if (blinkTimer) clearTimeout(blinkTimer)
    }
  }, [])

  useEffect(() => {
    // Triple guard: Module-level + component-level + fetching flag
    // Đảm bảo API chỉ được gọi 1 lần duy nhất trong toàn bộ app lifecycle
    if (hasStartedPromptPoll.current) return

    hasStartedPromptPoll.current = true

    const fetchPrompt = async () => {
      // Double guard: Tránh race condition nếu fetch được gọi nhiều lần
      if (isFetchingPrompt.current) return
      isFetchingPrompt.current = true

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

    // Chỉ cleanup interval nếu có
    return () => {
      if (promptIntervalRef.current) {
        clearInterval(promptIntervalRef.current)
        promptIntervalRef.current = null
      }
    }
  }, [])

  useLayoutEffect(() => {
    // Measure prompt width to drive smooth container resizing - full text width
    let rafId: number

    const measure = () => {
      const node = measureRef.current
      if (!node) return

      // Get computed styles để tính toán chính xác
      const computedStyle = window.getComputedStyle(node)
      const paddingLeft = parseFloat(computedStyle.paddingLeft)
      const paddingRight = parseFloat(computedStyle.paddingRight)

      // Check if we're on mobile (viewport width < 640px)
      const isMobile = window.innerWidth < 640

      // Đo width và height thực tế cho cả desktop và mobile
      const rect = node.getBoundingClientRect()
      const measuredWidth = rect.width
      const measuredHeight = rect.height

      // Calculate max allowed width based on device
      const maxAllowedWidth = isMobile
        ? window.innerWidth // viewport width on mobile
        : measuredWidth // Use measured width on desktop (will be clamped by CSS max-w-[90vw] on mobile)

      // Đảm bảo min width 140px và không vượt quá max allowed width
      const finalWidth = clamp(
        Math.max(measuredWidth, 140 + paddingLeft + paddingRight),
        140 + paddingLeft + paddingRight,
        maxAllowedWidth
      )

      const finalHeight = Math.max(measuredHeight, 48) // min-height 3rem = 48px
      // Update width
      setBubbleWidth(prev => {
        if (prev !== finalWidth) {
          const diff = Math.abs(prev - finalWidth)
          if (diff > 1) {
            return finalWidth
          }
        }
        return prev
      })

      // Update height
      setBubbleHeight(prev => {
        if (prev !== finalHeight) {
          const diff = Math.abs(prev - finalHeight)
          if (diff > 1) {
            return finalHeight
          }
        }
        return prev
      })
    }

    // Debounce measurement to avoid spam during rapid changes
    const debounceMeasure = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(measure)
    }

    debounceMeasure()

    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [prompt])

  // Control prompt appearance timing - bubble wrapper first, then prompt text
  useEffect(() => {
    if (prompt) {
      // Bubble wrapper xuất hiện trước, prompt text xuất hiện sau
      const timer = setTimeout(() => {
        setShowPrompt(true)
      }, 500) // Delay 500ms để bubble wrapper xuất hiện trước

      return () => clearTimeout(timer)
    } else {
      // Khi ẩn, reset ngay lập tức
      setShowPrompt(false)
    }
  }, [prompt])

  return (
    <div className={cn('flex flex-col items-center gap-5')}>
      {/* Reserve space để tránh layout shift - luôn render bubble container */}
      <motion.div
        ref={promptBubbleRef}
        layout // Enable layout animations for smooth width changes
        className={cn(
          'absolute rounded-2xl border border-white/20 bg-black/70 md:p-0 p-3 text-center text-base text-slate-100 shadow-xl backdrop-blur',
          'origin-bottom motion-reduce:transition-none',
          'flex items-center justify-center',
          'will-change-[transform,width,opacity]', // Performance optimization
          'transform-gpu', // Hardware acceleration
          // Responsive text wrapping và width constraints
          'max-w-[90vw]', // Giới hạn width trên mobile
          'whitespace-normal'
        )}
        initial={{
          width: 140 + 24, // 140px + padding (12px * 2)
          height: 48, // min-height
          y: 8,
          opacity: 0,
          pointerEvents: 'none'
        }}
        animate={{
          width: bubbleWidth,
          height: bubbleHeight,
          y: prompt ? -bubbleHeight - 12 : 8, // Dynamic y position based on bubble height
          opacity: prompt ? 1 : 0,
          pointerEvents: prompt ? 'auto' : 'none'
        }}
        transition={{
          type: 'spring',
          stiffness: 180, // Mượt hơn - thấp hơn để ít bounce
          damping: 25, // Cao hơn để ít oscillation
          mass: 0.8, // Nhẹ hơn để responsive hơn
          // Separate transitions for different properties
          opacity: { duration: 0.3, ease: 'easeOut' },
          y: { type: 'spring', stiffness: 200, damping: 25 },
          width: { type: 'spring', stiffness: 150, damping: 30 }, // Width animation mượt hơn
          height: { type: 'spring', stiffness: 150, damping: 30 } // Height animation
        }}
      >
        <motion.div
          className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-[calc(50%-0.5px)] h-4 w-4 rotate-45 border-b border-r border-white/20 bg-black will-change-opacity"
          animate={{
            opacity: prompt ? 1 : 0,
            scale: prompt ? 1 : 0.8 // Subtle scale animation cho arrow
          }}
          transition={{
            opacity: { duration: 0.3, ease: 'easeOut' },
            scale: { duration: 0.4, ease: 'easeOut' },
            delay: prompt ? 0.1 : 0 // Arrow xuất hiện sau bubble wrapper một chút
          }}
        />
        {showPrompt ? (
          <TextGenerateEffect
            words={prompt}
            className="text-slate-100 text-base font-normal"
            filter={true}
            duration={0.4}
          />
        ) : (
          <span className="text-slate-100 text-base"></span>
        )}
      </motion.div>
      {/* Hidden measurer to size bubble width - respect mobile constraints */}
      <div
        ref={measureRef}
        className="pointer-events-none absolute left-0 top-0 z-[-1] px-3 py-3 text-base font-normal opacity-0 max-w-[90vw] whitespace-normal"
        style={{
          width: 'max-content', // Fit content width but respect max-width
          height: 'max-content'
        }}
      >
        {prompt || '\u00A0'}
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
              <motion.div
                key={index}
                className="h-3 w-3 rounded-full bg-white will-change-transform"
                animate={{
                  x: pupilPositions.x,
                  y: pupilPositions.y,
                  scaleY: isBlinking ? 0 : 1
                }}
                transition={{
                  x: { type: 'spring', stiffness: 400, damping: 110 },
                  y: { type: 'spring', stiffness: 400, damping: 110 },
                  scaleY: { duration: 0.15, ease: 'easeInOut' }
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
