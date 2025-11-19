import type { EmbedDocumentsFn, EmbedQueryFn } from '@/lib/rag/types/rag'
import { OpenAIEmbeddings } from '@langchain/openai'

export interface EmbeddingProvider {
  embedQuery: EmbedQueryFn
  embedDocuments: EmbedDocumentsFn
}

class HashEmbeddingProvider implements EmbeddingProvider {
  constructor(private dimension = 1536) {}

  embedQuery: EmbedQueryFn = async text => this.hash(text)

  embedDocuments: EmbedDocumentsFn = async documents =>
    Promise.all(documents.map(doc => this.hash(doc)))

  private hash(text: string): number[] {
    const vector = new Array(this.dimension).fill(0)
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i)
      const index = code % this.dimension
      vector[index] += (code % 13) / 13
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
    return vector.map(value => value / norm)
  }
}

let cachedProvider: EmbeddingProvider | null = null

export function getEmbeddingProvider(dimension?: number): EmbeddingProvider {
  if (globalThis.__MORPHIC_EMBEDDING_PROVIDER__) {
    return globalThis.__MORPHIC_EMBEDDING_PROVIDER__ as EmbeddingProvider
  }

  if (cachedProvider) {
    return cachedProvider
  }

  const embedProvider =
    process.env.RAG_EMBED_PROVIDER?.toLowerCase() ?? 'hash'
  const openAiKey =
    process.env.RAG_EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY
  const embedModel = process.env.RAG_EMBED_MODEL ?? 'text-embedding-3-small'

  if (embedProvider === 'openai' && openAiKey) {
    const openAiProvider = new OpenAIEmbeddingProvider(openAiKey, embedModel)
    cachedProvider = openAiProvider
    return cachedProvider
  }

  cachedProvider = new HashEmbeddingProvider(dimension ?? 1536)
  return cachedProvider
}

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  var __MORPHIC_EMBEDDING_PROVIDER__: EmbeddingProvider | undefined
}

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private embeddings: OpenAIEmbeddings

  constructor(apiKey: string, modelName: string) {
    this.embeddings = new OpenAIEmbeddings({
      apiKey,
      modelName
    })
  }

  embedQuery: EmbedQueryFn = async text => {
    return this.embeddings.embedQuery(text)
  }

  embedDocuments: EmbedDocumentsFn = async documents => {
    return this.embeddings.embedDocuments(documents)
  }
}
