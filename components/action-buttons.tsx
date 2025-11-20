'use client'

import { useEffect, useRef, useState } from 'react'

import {
  FileText,
  HelpCircle,
  LucideIcon,
  Newspaper,
  Scale,
  Search
} from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from './ui/button'

// Constants for timing delays
const FOCUS_OUT_DELAY_MS = 100 // Delay to ensure focus has actually moved

interface ActionCategory {
  icon: LucideIcon
  label: string
  key: string
}

const actionCategories: ActionCategory[] = [
  {
    icon: Search,
    label: 'Research',
    key: 'research'
  },
  {
    icon: Scale,
    label: 'Compare',
    key: 'compare'
  },
  {
    icon: Newspaper,
    label: 'Latest',
    key: 'latest'
  },
  {
    icon: FileText,
    label: 'Summarize',
    key: 'summarize'
  },
  {
    icon: HelpCircle,
    label: 'Explain',
    key: 'explain'
  }
]

const promptSamples: Record<string, string[]> = {
  research: [
    'Trace how open-source LLM capabilities shifted over the last year',
    'Investigate why fusion energy funding is accelerating now',
    'What policies are shaping the EU AI Act rollout?',
    'Which startups are redefining personal robotics in 2025?'
  ],
  compare: [
    'Contrast Claude, GPT-4o, and Gemini for multilingual synthesis',
    'Compare pgvector, Qdrant, and Pinecone for RAG scale and cost',
    'Modal vs Fly.io vs Lambda: reliability and latency trade-offs',
    'Evaluate Perplexity, Arc Search, and Brave Search for research'
  ],
  latest: [
    'What are the most credible AI safety updates this week?',
    'Latest scientific breakthroughs in reusable rocket tech',
    'Recent moves in the quantum computing hardware race',
    'Notable cybersecurity incidents from the past 72 hours'
  ],
  summarize: [
    'Distill this report into 5 adaptive bullet points: <paste link>',
    'Turn this changelog into an executive brief with risks highlighted',
    'Summarize this podcast transcript with key tensions and takeaways',
    'Reduce this policy draft to a crisp problem/solution outline'
  ],
  explain: [
    'Explain retrieval-augmented generation for a product manager',
    'How do diffusion models differ from GANs? Include trade-offs',
    'Walk me through how L2 rollups settle on Ethereum',
    'Explain vector embeddings using a real-world analogy'
  ]
}

interface ActionButtonsProps {
  onSelectPrompt: (prompt: string) => void
  onCategoryClick: (category: string) => void
  inputRef?: React.RefObject<HTMLTextAreaElement>
  className?: string
}

export function ActionButtons({
  onSelectPrompt,
  onCategoryClick,
  inputRef,
  className
}: ActionButtonsProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleCategoryClick = (category: ActionCategory) => {
    setActiveCategory(category.key)
    onCategoryClick(category.label)
  }

  const handlePromptClick = (prompt: string) => {
    setActiveCategory(null)
    onSelectPrompt(prompt)
  }

  const resetToButtons = () => {
    setActiveCategory(null)
  }

  // Handle Escape key and clicks outside (including focus loss)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeCategory) {
        resetToButtons()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (activeCategory) {
          // Check if click is not on the input field
          if (!inputRef?.current?.contains(e.target as Node)) {
            resetToButtons()
          }
        }
      }
    }

    const handleFocusOut = () => {
      // Check if focus is moving outside both the container and input
      setTimeout(() => {
        const activeElement = document.activeElement
        if (
          activeCategory &&
          !containerRef.current?.contains(activeElement) &&
          activeElement !== inputRef?.current
        ) {
          resetToButtons()
        }
      }, FOCUS_OUT_DELAY_MS)
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [activeCategory, inputRef])

  // Calculate max height needed for samples (4 items * ~40px + padding)
  const containerHeight = 'h-[180px]'

  return (
    <div
      ref={containerRef}
      className={cn('relative', containerHeight, className)}
    >
      <div className="relative h-full">
        {/* Action buttons */}
        <div
          className={cn(
            'absolute inset-0 flex items-start justify-center pt-2 transition-opacity duration-300',
            activeCategory ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
          <div className="flex flex-wrap justify-center gap-2 px-2">
            {actionCategories.map(category => {
              const Icon = category.icon
              return (
                <Button
                  key={category.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-full',
                    'text-xs sm:text-sm px-3 sm:px-4'
                  )}
                  onClick={() => handleCategoryClick(category)}
                >
                  <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>{category.label}</span>
                </Button>
              )
            })}
          </div>
        </div>

        {/* Prompt samples */}
        <div
          className={cn(
            'absolute inset-0 py-1 space-y-1 overflow-y-auto transition-opacity duration-300',
            !activeCategory ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
          {activeCategory &&
            promptSamples[activeCategory]?.map((prompt, index) => (
              <button
                key={index}
                type="button"
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm',
                  'hover:bg-muted transition-colors',
                  'flex items-center gap-2 group'
                )}
                onClick={() => handlePromptClick(prompt)}
              >
                <Search className="h-3 w-3 text-muted-foreground flex-shrink-0 group-hover:text-foreground" />
                <span className="line-clamp-1">{prompt}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
