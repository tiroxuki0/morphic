import type {
  RagChunk,
  RagResult,
  SearchOptions,
  VectorStore,
  VectorStoreConfig
} from '@/lib/rag/types/rag'

type ChromaResponse<T> = {
  data: T
}

export class ChromaVectorStore implements VectorStore {
  readonly type = 'chroma'

  constructor(private config: VectorStoreConfig) {}

  async initialize(config?: VectorStoreConfig): Promise<void> {
    this.config = { ...this.config, ...config }
    if (!this.config.baseUrl) {
      this.config.baseUrl = 'http://localhost:8000'
    }
    if (!this.config.collectionName) {
      this.config.collectionName = 'morphic-rag'
    }
  }

  async upsert(chunks: RagChunk[]): Promise<void> {
    if (!this.config.baseUrl || !this.config.collectionName) {
      await this.initialize()
    }

    const documents = chunks.map(chunk => chunk.content)
    const metadatas = chunks.map(chunk => ({
      title: chunk.title,
      ...chunk.metadata
    }))
    const ids = chunks.map(chunk => chunk.chunkId)

    await this.request(`/collections/${this.config.collectionName}/add`, {
      ids,
      documents,
      metadatas
    })
  }

  async query(query: string, options: SearchOptions): Promise<RagResult[]> {
    if (!this.config.baseUrl || !this.config.collectionName) {
      await this.initialize()
    }

    const response = await this.request<{
      ids: string[][]
      metadatas: Record<string, unknown>[][]
      documents: string[][]
      distances: number[][]
    }>(`/collections/${this.config.collectionName}/query`, {
      query_texts: [query],
      n_results: options.topK ?? 5
    })

    const [ids, metadatas, documents, distances] = [
      response.ids[0],
      response.metadatas[0],
      response.documents[0],
      response.distances[0]
    ]

    return ids.map((id, index) => ({
      provider: 'chroma',
      score: distances[index] ?? 0,
      chunk: {
        id,
        chunkId: id,
        chunkIndex: index,
        title: (metadatas[index]?.title as string) || '',
        content: documents[index] ?? '',
        metadata: metadatas[index] ?? {}
      }
    }))
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.request('/heartbeat', undefined, 'GET')
      return true
    } catch {
      return false
    }
  }

  private async request<T = any>(
    pathname: string,
    body?: Record<string, unknown>,
    method: 'POST' | 'GET' = 'POST'
  ): Promise<T> {
    if (!this.config.baseUrl) {
      throw new Error('Chroma baseUrl is not configured')
    }

    const response = await fetch(new URL(`/api/v1${pathname}`, this.config.baseUrl), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {})
      },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
      signal: this.config.signal as AbortSignal | undefined
    })

    if (!response.ok) {
      throw new Error(`Chroma request failed: ${response.statusText}`)
    }

    const json = (await response.json()) as ChromaResponse<T> | T
    return 'data' in (json as ChromaResponse<T>) ? (json as ChromaResponse<T>).data : (json as T)
  }
}
