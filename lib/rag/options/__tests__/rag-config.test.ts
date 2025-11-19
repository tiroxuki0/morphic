import { beforeEach, describe, expect, it } from 'vitest'

import { loadRagConfig } from '../rag-config'

describe('loadRagConfig', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key]
    }
    Object.assign(process.env, originalEnv)
  })

  it('returns disabled config by default', () => {
    const config = loadRagConfig(true)
    expect(config.enabled).toBe(false)
    expect(config.providers).toContain('confluence')
  })

  it('parses environment variables when enabled', () => {
    process.env.RAG_ENABLED = 'true'
    process.env.RAG_PROVIDER = 'confluence'
    process.env.RAG_PROVIDERS = 'confluence,custom'
    process.env.RAG_VECTOR_STORE = 'qdrant'
    process.env.RAG_CHUNK_SIZE = '2048'
    process.env.RAG_CHUNK_OVERLAP = '128'

    const config = loadRagConfig(true)

    expect(config.enabled).toBe(true)
    expect(config.providers).toEqual(['confluence', 'custom'])
    expect(config.vectorStore.type).toBe('qdrant')
    expect(config.options.chunkSize).toBe(2048)
    expect(config.options.chunkOverlap).toBe(128)
  })
})
