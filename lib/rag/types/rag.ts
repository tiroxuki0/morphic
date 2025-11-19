export type VectorStoreType = 'pinecone' | 'qdrant' | 'chroma'

export type EmbedQueryFn = (text: string) => Promise<number[]>
export type EmbedDocumentsFn = (documents: string[]) => Promise<number[][]>

export interface VectorStoreConfig {
  apiKey?: string
  baseUrl?: string
  indexName?: string
  collectionName?: string
  namespace?: string
  metadataFilterField?: string
  embeddingDimension?: number
  embedQuery?: EmbedQueryFn
  embedDocuments?: EmbedDocumentsFn
  timeoutMs?: number
  [key: string]: unknown
}

export interface RagOptions {
  chunkSize: number
  chunkOverlap: number
  maxContextLength: number
  hybridMode: boolean
  rankingStrategy: 'semantic' | 'hybrid'
  returnCitations: boolean
}

export interface RagConfig {
  enabled: boolean
  provider: 'confluence' | 'multi'
  providers: string[]
  defaultPreset?: string
  vectorStore: {
    type: VectorStoreType
    config: VectorStoreConfig
  }
  options: RagOptions
}

export interface RagSearchConfig {
  provider?: string
  preset?: string
  topK?: number
  hybridMode?: boolean
  signal?: AbortSignal
}

export interface RagDocumentMetadata {
  author?: string
  lastModified?: string
  labels?: string[]
  path?: string
  url?: string
  spaceKey?: string
  [key: string]: unknown
}

export interface RagDocument {
  id: string
  title: string
  content: string
  url?: string
  metadata: RagDocumentMetadata
}

export interface RagChunk extends RagDocument {
  chunkId: string
  chunkIndex: number
  embedding?: number[]
}

export interface RagResult {
  provider: string
  score: number
  chunk: RagChunk
  highlight?: string
}

export interface SearchOptions {
  topK?: number
  filter?: Record<string, unknown>
  hybridMode?: boolean
  signal?: AbortSignal
}

export interface RagProvider {
  name: string
  initialize(config: RagConfig): Promise<void>
  isEnabled(): boolean
  index(documents: RagDocument[]): Promise<void>
  search(query: string, options: SearchOptions): Promise<RagResult[]>
}

export interface VectorStore {
  type: VectorStoreType
  initialize(config?: VectorStoreConfig): Promise<void>
  upsert(chunks: RagChunk[]): Promise<void>
  query(query: string, options: SearchOptions): Promise<RagResult[]>
  isHealthy(): Promise<boolean>
}

export type RagPreset = {
  providers: string[]
  vectorStore: VectorStoreType
  chunkSize: number
  overlap: number
}

export type RagPresetMap = Record<string, RagPreset>

export type RagPresetFile = RagPresetMap & {
  $schema?: string
}
