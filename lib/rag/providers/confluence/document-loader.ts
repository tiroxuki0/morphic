import TurndownService from 'turndown'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'

import type { RagChunk, RagDocument, RagOptions } from '@/lib/rag/types/rag'
import type {
  ConfluenceConnector,
  ConfluencePage
} from '@/lib/rag/providers/confluence/connector'

export class ConfluenceDocumentLoader {
  private turndown = new TurndownService({ headingStyle: 'atx' })
  private splitter: RecursiveCharacterTextSplitter

  constructor(
    private connector: ConfluenceConnector,
    ragOptions: RagOptions
  ) {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: ragOptions.chunkSize,
      chunkOverlap: ragOptions.chunkOverlap
    })
  }

  async loadSpace(spaceKey: string, limit = 100): Promise<RagDocument[]> {
    const cql = `space="${spaceKey}" and type=page`
    const pages = await this.fetchAllPages(cql, limit)
    return pages.map(page => this.transformPageToDocument(page))
  }

  async chunkDocument(document: RagDocument): Promise<RagChunk[]> {
    const chunks = await this.splitter.splitText(document.content)
    return chunks.map((chunk, index) => ({
      ...document,
      chunkId: `${document.id}:${index}`,
      chunkIndex: index,
      content: chunk
    }))
  }

  private async fetchAllPages(cql: string, limit: number) {
    const pages: ConfluencePage[] = []
    let cursor: string | undefined

    do {
      const response = await this.connector.searchPages(cql, limit, cursor)
      pages.push(...response.results)
      cursor = response._links?.next
    } while (cursor)

    return pages
  }

  private transformPageToDocument(page: ConfluencePage): RagDocument {
    const html = page.body?.storage?.value ?? ''
    const markdown = this.turndown.turndown(html)
    const baseUrl = this.connector.getBaseUrl()
    const url = page._links?.webui
      ? new URL(page._links.webui, baseUrl).toString()
      : undefined

    return {
      id: page.id,
      title: page.title,
      content: markdown,
      url,
      metadata: {
        author: page.history?.createdBy?.publicName,
        lastModified:
          page.version?.when || page.history?.lastUpdated?.when,
        labels: page.metadata?.labels,
        spaceKey: page.metadata?.space?.key
      }
    }
  }
}
