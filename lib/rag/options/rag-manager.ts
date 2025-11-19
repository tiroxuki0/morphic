import type {
  RagConfig,
  RagProvider,
  RagResult,
  RagSearchConfig,
  SearchOptions
} from '@/lib/rag/types/rag'
import { loadRagConfig } from '@/lib/rag/options/rag-config'
import { ConfluenceRagProvider } from '@/lib/rag/providers/confluence/provider'

type ProviderFactory = () => RagProvider

const registry = new Map<string, ProviderFactory>([
  ['confluence', () => new ConfluenceRagProvider()]
])

export class RagManager {
  private providers: Map<string, RagProvider> = new Map()
  private initialized = false

  constructor(private config: RagConfig) {}

  async initialize() {
    if (this.initialized || !this.config.enabled) {
      return
    }

    for (const providerName of this.config.providers) {
      if (!registry.has(providerName)) continue
      const factory = registry.get(providerName)!
      const provider = factory()
      await provider.initialize(this.config)
      this.providers.set(providerName, provider)
    }

    this.initialized = true
  }

  async addProvider(name: string, provider: RagProvider) {
    await provider.initialize(this.config)
    this.providers.set(name, provider)
  }

  async search(
    query: string,
    searchConfig: RagSearchConfig = {}
  ): Promise<RagResult[]> {
    if (!this.config.enabled) {
      return []
    }
    await this.initialize()

    const providers =
      searchConfig.provider && this.providers.has(searchConfig.provider)
        ? [this.providers.get(searchConfig.provider)!]
        : Array.from(this.providers.values())

    const searchOptions: SearchOptions = {
      topK: searchConfig.topK ?? 5,
      hybridMode: searchConfig.hybridMode ?? this.config.options.hybridMode,
      signal: searchConfig.signal
    }

    const results = await Promise.all(
      providers.map(provider => provider.search(query, searchOptions))
    )

    return results.flat().sort((a, b) => b.score - a.score)
  }

  getEnabledProviders() {
    return Array.from(this.providers.keys())
  }
}

let cachedManager: RagManager | null = null

export function getRagManager() {
  if (cachedManager) return cachedManager
  cachedManager = new RagManager(loadRagConfig())
  return cachedManager
}

export function registerRagProvider(name: string, factory: ProviderFactory) {
  registry.set(name, factory)
}
