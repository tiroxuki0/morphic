'use client'
import { cn } from '@/lib/utils/index'
import { motion, stagger, useAnimate } from 'motion/react'
import { useEffect } from 'react'

export const TextGenerateEffect = ({
  words,
  className,
  filter = true,
  duration = 0.5
}: {
  words: string
  className?: string
  filter?: boolean
  duration?: number
}) => {
  const [scope, animate] = useAnimate()
  let wordsArray = words.split(' ')
  useEffect(() => {
    // Reset animation state first
    animate(
      'span',
      {
        opacity: 0,
        filter: filter ? 'blur(10px)' : 'none'
      },
      {
        duration: 0 // Instant reset
      }
    ).then(() => {
      // Then animate in
      animate(
        'span',
        {
          opacity: 1,
          filter: filter ? 'blur(0px)' : 'none'
        },
        {
          duration: duration ? duration : 1,
          delay: stagger(0.2)
        }
      )
    })
  }, [scope.current, words, filter, duration])

  const renderWords = () => {
    return (
      <motion.div ref={scope} className="inline-block">
        {wordsArray.map((word, idx) => {
          return (
            <motion.span
              key={`${word}-${idx}-${words}`}
              style={{
                opacity: 0,
                filter: filter ? 'blur(10px)' : 'none',
                // Reserve space ngay cả khi opacity-0
                visibility: 'visible'
              }}
            >
              {word}{' '}
            </motion.span>
          )
        })}
      </motion.div>
    )
  }

  return (
    <div className={cn('w-fit', className)}>
      <div className="text-center ">{renderWords()}</div>
    </div>
  )
}
