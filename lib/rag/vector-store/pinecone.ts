import {
  Errors,
  Pinecone,
  type RecordMetadata,
  type ServerlessSpecCloudEnum
} from '@pinecone-database/pinecone'

import type {
  RagChunk,
  RagResult,
  SearchOptions,
  VectorStore,
  VectorStoreConfig
} from '@/lib/rag/types/rag'

function toPineconeMetadata(metadata: Record<string, unknown>): RecordMetadata {
  const record: RecordMetadata = {}

  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      record[key] = value
    } else if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      record[key] = value
    } else {
      record[key] = JSON.stringify(value)
    }
  }

  return record
}

function resolveServerlessCloud(cloud?: unknown): ServerlessSpecCloudEnum {
  const normalized = typeof cloud === 'string' ? cloud.toLowerCase() : null

  if (normalized === 'aws' || normalized === 'gcp' || normalized === 'azure') {
    return normalized
  }

  return 'aws'
}

export class PineconeVectorStore implements VectorStore {
  readonly type = 'pinecone'
  private client: Pinecone | null = null
  private index: ReturnType<Pinecone['Index']> | ReturnType<ReturnType<Pinecone['Index']>['namespace']> | null = null

  constructor(private config: VectorStoreConfig) {}

  async initialize(config?: VectorStoreConfig): Promise<void> {
    this.config = { ...this.config, ...config }
    if (!this.config.apiKey) {
      throw new Error('PINECONE_API_KEY is required for Pinecone vector store')
    }
    if (!this.config.indexName) {
      throw new Error('PINECONE_INDEX is required for Pinecone vector store')
    }

    this.client = new Pinecone({
      apiKey: this.config.apiKey
    })
    await this.ensureIndexExists()
    const baseIndex = this.client.Index(this.config.indexName)
    this.index = this.config.namespace
      ? baseIndex.namespace(this.config.namespace)
      : baseIndex
  }

  async upsert(chunks: RagChunk[]): Promise<void> {
    if (!this.index) {
      await this.initialize()
    }
    if (!this.index) {
      throw new Error('Pinecone index is not initialized')
    }

    const vectors: Array<{
      id: string
      values: number[]
      metadata: RecordMetadata
    }> = []

    for (const chunk of chunks) {
      const embedding =
        chunk.embedding ||
        (await this.embedDocuments([chunk.content]))?.[0] ||
        null

      if (!embedding) {
        throw new Error('Unable to compute embedding for chunk')
      }

      vectors.push({
        id: chunk.chunkId,
        values: embedding,
        metadata: toPineconeMetadata({
          text: chunk.content,
          title: chunk.title,
          ...chunk.metadata
        })
      })
    }

    const batchSize = Number(this.config.batchSize ?? 50)
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize)
      await this.index.upsert(batch)
    }
  }

  async query(query: string, options: SearchOptions): Promise<RagResult[]> {
    if (!this.index) {
      await this.initialize()
    }
    if (!this.index) {
      throw new Error('Pinecone index is not initialized')
    }

    const vector = await this.embedQuery(query)
    const response = await this.index.query({
      vector,
      topK: options.topK ?? 5,
      includeMetadata: true
    })

    return (
      response.matches?.map(match => ({
        provider: 'pinecone',
        score: match.score ?? 0,
        chunk: {
          id: match.id ?? '',
          chunkId: match.id ?? '',
          chunkIndex: 0,
          title: (match.metadata?.title as string) || '',
          content: (match.metadata?.text as string) || '',
          metadata: (match.metadata as Record<string, unknown>) || {},
          url: match.metadata?.url as string | undefined
        }
      })) ?? []
    )
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.index) {
        await this.initialize()
      }
      await this.index?.describeIndexStats()
      return true
    } catch {
      return false
    }
  }

  private async ensureIndexExists() {
    if (!this.client) return
    try {
      await this.client.describeIndex(this.config.indexName as string)
    } catch (error) {
      if (error instanceof Errors.PineconeNotFoundError) {
        await this.client.createIndex({
          name: this.config.indexName as string,
          dimension: this.config.embeddingDimension ?? 1536,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: resolveServerlessCloud(
                this.config.cloud ?? process.env.PINECONE_CLOUD
              ),
              region: (this.config.region as string) ?? process.env.PINECONE_REGION ?? 'us-east-1'
            }
          },
          waitUntilReady: true
        })
        return
      }
      throw error
    }
  }

  private async embedQuery(query: string) {
    if (this.config.embedQuery) {
      return this.config.embedQuery(query)
    }
    throw new Error('No embedding function provided for Pinecone queries')
  }

  private async embedDocuments(documents: string[]) {
    if (this.config.embedDocuments) {
      return this.config.embedDocuments(documents)
    }
    return null
  }
}
