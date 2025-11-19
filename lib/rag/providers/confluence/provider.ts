import type {
  RagConfig,
  RagDocument,
  RagResult,
  SearchOptions,
  VectorStore
} from '@/lib/rag/types/rag'
import { BaseRagProvider } from '@/lib/rag/providers/base/rag-provider'
import { ConfluenceConnector } from '@/lib/rag/providers/confluence/connector'
import { ConfluenceDocumentLoader } from '@/lib/rag/providers/confluence/document-loader'
import { ConfluenceIndexer } from '@/lib/rag/providers/confluence/indexer'
import { createVectorStore } from '@/lib/rag/vector-store'
import { getEmbeddingProvider } from '@/lib/rag/options/embedder'

export class ConfluenceRagProvider extends BaseRagProvider {
  private connector: ConfluenceConnector | null = null
  private loader: ConfluenceDocumentLoader | null = null
  private indexer: ConfluenceIndexer | null = null
  private vectorStore: VectorStore | null = null

  constructor() {
    super('confluence')
  }

  protected async onInitialize(config: RagConfig): Promise<void> {
    this.connector = new ConfluenceConnector({
      baseUrl: process.env.CONFLUENCE_BASE_URL ?? '',
      email: process.env.CONFLUENCE_EMAIL,
      apiToken: process.env.CONFLUENCE_API_TOKEN,
      oauthToken: process.env.CONFLUENCE_OAUTH_TOKEN,
      authType: process.env.CONFLUENCE_OAUTH_TOKEN ? 'oauth' : 'apiToken'
    })

    this.loader = new ConfluenceDocumentLoader(this.connector, config.options)
    const embeddings = getEmbeddingProvider(config.vectorStore.config.embeddingDimension)
    this.vectorStore = createVectorStore(config.vectorStore.type, {
      ...config.vectorStore.config,
      embedQuery: embeddings.embedQuery,
      embedDocuments: embeddings.embedDocuments
    })
    await this.vectorStore.initialize()
    this.indexer = new ConfluenceIndexer(this.loader, this.vectorStore)
  }

  async index(documents: RagDocument[]): Promise<void> {
    if (!this.indexer) {
      throw new Error('Confluence provider is not initialized')
    }
    await this.indexer.indexDocuments(documents)
  }

  async search(query: string, options: SearchOptions): Promise<RagResult[]> {
    if (!this.vectorStore) {
      throw new Error('Confluence provider is not initialized')
    }
    return this.vectorStore.query(query, options).then(results =>
      results.map(result => ({
        ...result,
        provider: this.name
      }))
    )
  }

  getLoader() {
    if (!this.loader) {
      throw new Error('Confluence loader not initialized')
    }
    return this.loader
  }
}
