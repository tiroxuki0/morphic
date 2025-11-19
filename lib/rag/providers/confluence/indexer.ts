import type { RagDocument, VectorStore } from '@/lib/rag/types/rag'
import { ConfluenceDocumentLoader } from '@/lib/rag/providers/confluence/document-loader'

export type IndexProgressStage =
  | 'fetching'
  | 'chunking'
  | 'upserting'
  | 'completed'

export interface IndexProgressEvent {
  stage: IndexProgressStage
  documents?: number
  chunks?: number
  skipped?: number
  message?: string
}

export interface IndexOptions {
  spaceKey: string
  limit?: number
  onProgress?: (event: IndexProgressEvent) => void
}

export interface IndexStats {
  documents: number
  chunks: number
  skipped: number
}

export class ConfluenceIndexer {
  constructor(
    private loader: ConfluenceDocumentLoader,
    private vectorStore: VectorStore
  ) {}

  async indexSpace({
    spaceKey,
    limit = 100,
    onProgress
  }: IndexOptions): Promise<IndexStats> {
    onProgress?.({
      stage: 'fetching',
      message: `Fetching up to ${limit} pages from space ${spaceKey}`
    })
    const documents = await this.loader.loadSpace(spaceKey, limit)
    onProgress?.({
      stage: 'chunking',
      documents: documents.length,
      message: `Chunking ${documents.length} documents`
    })
    return this.indexDocuments(documents, onProgress)
  }

  async indexDocuments(
    documents: RagDocument[],
    onProgress?: (event: IndexProgressEvent) => void
  ): Promise<IndexStats> {
    let skipped = 0
    const chunkedDocuments = await Promise.all(
      documents.map(async doc => {
        if (!doc.content.trim()) {
          skipped++
          return []
        }
        return this.loader.chunkDocument(doc)
      })
    )
    const flattened = chunkedDocuments.flat()
    onProgress?.({
      stage: 'upserting',
      documents: documents.length,
      chunks: flattened.length,
      skipped,
      message: `Uploading ${flattened.length} chunks`
    })
    if (flattened.length) {
      await this.vectorStore.upsert(flattened)
    }
    const stats = {
      documents: documents.length,
      chunks: flattened.length,
      skipped
    }
    onProgress?.({
      stage: 'completed',
      ...stats,
      message: `Completed indexing ${documents.length} documents`
    })
    return stats
  }
}
