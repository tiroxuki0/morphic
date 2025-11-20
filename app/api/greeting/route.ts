import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { generateText } from 'ai'

import { selectModel } from '@/lib/utils/model-selection'
import { getModel } from '@/lib/utils/registry'

const FALLBACKS = [
  'Bạn đang làm gì hôm nay?',
  'Có trend Việt Nam nào khiến bạn tò mò?',
  'Muốn cập nhật tin nóng thế giới không?',
  'Bạn đang chuẩn bị cho project nào?',
  'Có câu hỏi nào muốn tôi đào sâu ngay không?'
]

export async function GET() {
  const fallback =
    FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)] ?? FALLBACKS[0]

  try {
    const cookieStore = await cookies()
    const safeCookieStore = {
      get: (...args: Parameters<typeof cookieStore.get>) =>
        typeof cookieStore.get === 'function'
          ? cookieStore.get(...args)
          : undefined,
      getAll: (...args: Parameters<typeof cookieStore.getAll>) =>
        typeof cookieStore.getAll === 'function'
          ? cookieStore.getAll(...args)
          : []
    }

    const model = selectModel({
      // Guard for environments where cookies() might not expose .get during static rendering
      cookieStore: safeCookieStore as any,
      searchMode: 'quick'
    })
    const modelId = `${model.providerId}:${model.id}`

    const system =
      'You are a concise greeter for a research AI. Respond with ONE short, friendly question (max 80 characters). ' +
      'Make it feel current by referencing either a Vietnam trend or a global headline theme if relevant, but without needing real-time data; keep it evergreen and non-specific. ' +
      'Avoid emojis. Return only the question.'

    const { text } = await generateText({
      model: getModel(modelId),
      system,
      prompt: 'Create a single-line greeting question.',
      maxOutputTokens: 50,
      temperature: 0.7
    })

    const trimmed = text.trim()
    return NextResponse.json({
      prompt: trimmed || fallback
    })
  } catch (error) {
    console.error('[greeting] generation failed', error)
    return NextResponse.json({ prompt: fallback }, { status: 200 })
  }
}
