import type {
  RagConfig,
  RagDocument,
  RagProvider,
  RagResult,
  SearchOptions
} from '@/lib/rag/types/rag'

export abstract class BaseRagProvider implements RagProvider {
  protected initialized = false
  protected config: RagConfig | null = null

  constructor(public readonly name: string) {}

  async initialize(config: RagConfig): Promise<void> {
    this.config = config
    await this.onInitialize(config)
    this.initialized = true
  }

  isEnabled(): boolean {
    return Boolean(this.config?.enabled)
  }

  abstract index(documents: RagDocument[]): Promise<void>
  abstract search(query: string, options: SearchOptions): Promise<RagResult[]>

  protected async onInitialize(_config: RagConfig): Promise<void> {
    // Optional hook for subclasses
  }
}
