import fs from 'node:fs'
import path from 'node:path'

import { config as loadEnv } from 'dotenv'

import { getEmbeddingProvider } from '@/lib/rag/options/embedder'
import { loadRagConfig } from '@/lib/rag/options/rag-config'
import { ConfluenceIndexer } from '@/lib/rag/providers/confluence/indexer'
import { ConfluenceRagProvider } from '@/lib/rag/providers/confluence/provider'
import { createVectorStore } from '@/lib/rag/vector-store'
import { ConfluenceAuthenticationError } from '@/lib/rag/providers/confluence/connector'

const defaultEnvPath = ['.env.local', '.env'].find(file =>
  fs.existsSync(path.resolve(process.cwd(), file))
)

loadEnv({
  path: process.env.DOTENV_CONFIG_PATH ?? defaultEnvPath
})

const args = process.argv.slice(2)
const positional = args.filter(arg => !arg.startsWith('--'))
const spaceKey = positional[0] ?? 'S5'
const showStats = args.includes('--stats')
const limitArg = args.find(arg => arg.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined

async function main() {
  const config = loadRagConfig(true)
  if (!config.enabled) throw new Error('Set RAG_ENABLED=true before indexing')

  const provider = new ConfluenceRagProvider()
  await provider.initialize(config)

  const embeddings = getEmbeddingProvider(
    config.vectorStore.config.embeddingDimension
  )
  const vectorStore = createVectorStore(config.vectorStore.type, {
    ...config.vectorStore.config,
    embedQuery: embeddings.embedQuery,
    embedDocuments: embeddings.embedDocuments
  })
  await vectorStore.initialize()

  const loader = provider.getLoader()
  const indexer = new ConfluenceIndexer(loader, vectorStore)

  const stats = await indexer.indexSpace({
    spaceKey,
    limit: limit ?? 500,
    onProgress: event => {
      const prefix = `[${event.stage.toUpperCase()}]`
      const details = []
      if (typeof event.documents === 'number') {
        details.push(`docs=${event.documents}`)
      }
      if (typeof event.chunks === 'number') {
        details.push(`chunks=${event.chunks}`)
      }
      if (typeof event.skipped === 'number' && event.skipped > 0) {
        details.push(`skipped=${event.skipped}`)
      }
      console.log(
        `${prefix} ${event.message ?? ''} ${details.length ? `(${details.join(', ')})` : ''}`.trim()
      )
    }
  })
  console.log(`Indexed space ${spaceKey}`)
  if (showStats) {
    console.log(
      `Indexed documents: ${stats.documents}, chunks: ${stats.chunks}, skipped: ${stats.skipped}`
    )
  }
}

main().catch(err => {
  if (err instanceof ConfluenceAuthenticationError) {
    console.error(
      `Confluence authentication failed (${err.status}). Verify the account has Confluence access and the API token/email pair is correct.\n${err.message}`
    )
  } else {
    console.error(err)
  }
  process.exit(1)
})
