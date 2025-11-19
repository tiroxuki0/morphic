import { QdrantClient } from '@qdrant/js-client-rest'

import type {
  RagChunk,
  RagResult,
  SearchOptions,
  VectorStore,
  VectorStoreConfig
} from '@/lib/rag/types/rag'

export class QdrantVectorStore implements VectorStore {
  readonly type = 'qdrant'
  private client: QdrantClient | null = null

  constructor(private config: VectorStoreConfig) {}

  async initialize(config?: VectorStoreConfig): Promise<void> {
    this.config = { ...this.config, ...config }
    if (!this.config.baseUrl) {
      throw new Error('QDRANT_URL is required for Qdrant vector store')
    }
    this.client = new QdrantClient({
      url: this.config.baseUrl,
      apiKey: this.config.apiKey
    })

    const collectionName = this.getCollectionName()
    const collections = await this.client.getCollections()
    const exists = collections.collections?.some(c => c.name === collectionName)

    if (!exists) {
      await this.client.createCollection(collectionName, {
        vectors: {
          size: this.config.embeddingDimension ?? 1536,
          distance: 'Cosine'
        }
      })
    }
  }

  async upsert(chunks: RagChunk[]): Promise<void> {
    if (!this.client) {
      await this.initialize()
    }
    if (!this.client) {
      throw new Error('Qdrant client not initialized')
    }

    const vectors: {
      id: string
      vector: number[]
      payload: Record<string, unknown>
    }[] = []

    for (const chunk of chunks) {
      const embedding =
        chunk.embedding ||
        (await this.embedDocuments([chunk.content]))?.[0] ||
        null
      if (!embedding) {
        throw new Error('Unable to compute embedding for Qdrant chunk')
      }

      vectors.push({
        id: chunk.chunkId,
        vector: embedding,
        payload: {
          text: chunk.content,
          title: chunk.title,
          ...chunk.metadata
        }
      })
    }

    await this.client.upsert(this.getCollectionName(), {
      wait: false,
      points: vectors
    })
  }

  async query(query: string, options: SearchOptions): Promise<RagResult[]> {
    if (!this.client) {
      await this.initialize()
    }
    if (!this.client) {
      throw new Error('Qdrant client not initialized')
    }

    const vector = await this.embedQuery(query)
    const results = await this.client.search(this.getCollectionName(), {
      vector,
      limit: options.topK ?? 5,
      with_payload: true
    })

    return results.map(result => ({
      provider: 'qdrant',
      score: result.score ?? 0,
      chunk: {
        id: String(result.id),
        chunkId: String(result.id),
        chunkIndex: 0,
        title: (result.payload?.title as string) || '',
        content: (result.payload?.text as string) || '',
        metadata: (result.payload as Record<string, unknown>) || {},
        url: result.payload?.url as string | undefined
      }
    }))
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.client) {
        await this.initialize()
      }
      const response = await this.client?.getCollections()
      return Boolean(response?.collections)
    } catch {
      return false
    }
  }

  private getCollectionName() {
    return (this.config.collectionName as string) || 'morphic-rag'
  }

  private async embedQuery(query: string) {
    if (this.config.embedQuery) {
      return this.config.embedQuery(query)
    }
    throw new Error('No embedding function provided for Qdrant queries')
  }

  private async embedDocuments(documents: string[]) {
    if (this.config.embedDocuments) {
      return this.config.embedDocuments(documents)
    }
    return null
  }
}
