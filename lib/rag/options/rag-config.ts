import fs from 'node:fs'
import path from 'node:path'

import type {
  RagConfig,
  RagPresetMap,
  VectorStoreConfig
} from '@/lib/rag/types/rag'

const DEFAULT_OPTIONS: RagConfig['options'] = {
  chunkSize: 1000,
  chunkOverlap: 200,
  maxContextLength: 3_000,
  hybridMode: false,
  rankingStrategy: 'semantic',
  returnCitations: true
}
const DEFAULT_EMBEDDING_DIMENSION = 1_536

let cachedConfig: RagConfig | null = null
let cachedPresets: RagPresetMap | null = null

function getEnvBoolean(key: string, defaultValue: boolean) {
  const value = process.env[key]
  if (value === undefined) return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function readPresetFile(): RagPresetMap {
  if (cachedPresets) {
    return cachedPresets
  }

  const presetPath = path.join(process.cwd(), 'config', 'rag-presets.json')
  if (!fs.existsSync(presetPath)) {
    cachedPresets = {}
    return cachedPresets
  }

  try {
    const raw = fs.readFileSync(presetPath, 'utf-8')
    cachedPresets = JSON.parse(raw)
  } catch {
    cachedPresets = {}
  }

  return cachedPresets
}

function resolveVectorStoreConfig(
  type: RagConfig['vectorStore']['type']
): VectorStoreConfig {
  switch (type) {
    case 'pinecone':
      return {
        apiKey: process.env.PINECONE_API_KEY,
        indexName: process.env.PINECONE_INDEX,
        namespace: process.env.PINECONE_NAMESPACE
      }
    case 'qdrant':
      return {
        apiKey: process.env.QDRANT_API_KEY,
        baseUrl: process.env.QDRANT_URL ?? 'http://localhost:6333',
        collectionName: process.env.QDRANT_COLLECTION ?? 'morphic-rag'
      }
    case 'chroma':
      return {
        baseUrl: process.env.CHROMA_URL ?? 'http://localhost:8000',
        collectionName: process.env.CHROMA_COLLECTION ?? 'morphic-rag'
      }
  }
}

export function loadRagConfig(forceReload = false): RagConfig {
  if (cachedConfig && !forceReload) {
    return cachedConfig
  }

  const presets = readPresetFile()
  const enabled = getEnvBoolean('RAG_ENABLED', false)
  const provider = (process.env.RAG_PROVIDER ??
    'confluence') as RagConfig['provider']
  const providers = process.env.RAG_PROVIDERS?.split(',')
    .map(p => p.trim())
    .filter(Boolean) ?? [provider]
  const presetName = process.env.RAG_PRESET
  const preset = (presetName && presets[presetName]) || null

  const vectorStoreType = ((preset?.vectorStore ??
    process.env.RAG_VECTOR_STORE) ||
    'pinecone') as RagConfig['vectorStore']['type']
  const envEmbeddingDimension = process.env.RAG_EMBED_DIMENSION
    ? Number(process.env.RAG_EMBED_DIMENSION)
    : undefined

  const options = {
    ...DEFAULT_OPTIONS,
    ...(preset
      ? {
          chunkSize: preset.chunkSize ?? DEFAULT_OPTIONS.chunkSize,
          chunkOverlap: preset.overlap ?? DEFAULT_OPTIONS.chunkOverlap
        }
      : {}),
    ...(process.env.RAG_CHUNK_SIZE
      ? { chunkSize: Number(process.env.RAG_CHUNK_SIZE) }
      : {}),
    ...(process.env.RAG_CHUNK_OVERLAP
      ? { chunkOverlap: Number(process.env.RAG_CHUNK_OVERLAP) }
      : {}),
    hybridMode: preset?.providers?.length
      ? preset.providers.length > 1
      : getEnvBoolean('RAG_HYBRID_MODE', DEFAULT_OPTIONS.hybridMode),
    rankingStrategy:
      (process.env
        .RAG_RANKING_STRATEGY as RagConfig['options']['rankingStrategy']) ??
      DEFAULT_OPTIONS.rankingStrategy,
    returnCitations: getEnvBoolean(
      'RAG_RETURN_CITATIONS',
      DEFAULT_OPTIONS.returnCitations
    )
  }

  const vectorStoreConfig = resolveVectorStoreConfig(vectorStoreType)
  vectorStoreConfig.embeddingDimension =
    envEmbeddingDimension ??
    vectorStoreConfig.embeddingDimension ??
    DEFAULT_EMBEDDING_DIMENSION

  cachedConfig = {
    enabled,
    provider,
    providers,
    defaultPreset: presetName ?? undefined,
    vectorStore: {
      type: vectorStoreType,
      config: vectorStoreConfig
    },
    options
  }

  return cachedConfig
}
