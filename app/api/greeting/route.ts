import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { generateText } from 'ai'

import { selectModel } from '@/lib/utils/model-selection'
import { getModel } from '@/lib/utils/registry'

const FALLBACKS = [
  'Hôm nay bạn muốn đào sâu chủ đề nào?',
  'Có dự án nào cần tôi gợi ý nghiên cứu?',
  'Muốn tôi lướt tin nóng hay đào sâu câu hỏi?',
  'Bạn tò mò điều gì nhất về công nghệ?',
  'Có link hoặc ý tưởng nào để tôi tóm tắt?'
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
      'You are a concise greeter for a research AI. Respond with ONE short, curious, and intelligent question of 8-10 words. ' +
      'Vary structure so it feels flexible, not templated; invite exploration or summarization without demanding specific data. ' +
      'Keep wording evergreen (no dated references), optional gentle nods to Vietnam or global themes are fine. ' +
      'Avoid emojis. Return only the question.'

    const { text } = await generateText({
      model: getModel(modelId),
      system,
      prompt:
        'Write a single-line greeting question (8-10 words) that feels flexible and smart.',
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
