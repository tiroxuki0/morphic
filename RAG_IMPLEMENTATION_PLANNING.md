# Planning: Implement RAG Confluence và RAG Options

## 🎯 Mục tiêu

- Implement RAG Confluence: RAG với dữ liệu từ Atlassian Confluence
- Implement RAG Options: Hệ thống RAG linh hoạt với nhiều cấu hình
- Tách biệt hoàn toàn: Không sửa đổi logic hiện tại của Darin
- Modular design: Có thể bật/tắt độc lập

## 🏗️ Kiến trúc Tổng quan

### 1. Cấu trúc Module Mới

```
lib/rag/
├── providers/
│   ├── confluence/
│   │   ├── connector.ts      # Kết nối Confluence API
│   │   ├── document-loader.ts # Load & parse Confluence pages
│   │   └── indexer.ts        # Index documents vào vector DB
│   └── base/
│       └── rag-provider.ts   # Interface chung cho RAG providers
├── options/
│   ├── rag-config.ts         # Cấu hình RAG options
│   ├── rag-manager.ts        # Quản lý RAG instances
│   └── presets/              # Preset configurations
├── vector-store/
│   ├── pinecone.ts           # Pinecone integration
│   ├── qdrant.ts             # Qdrant integration
│   └── chroma.ts             # Chroma integration
└── types/
    └── rag.ts                # Type definitions
```

### 2. Integration Points

- **Tách biệt với researcher hiện tại**: Không sửa `lib/agents/researcher.ts`
- **Hook vào chat flow**: Thêm RAG enhancement tại `lib/actions/chat.ts`
- **Config-based**: Sử dụng environment variables và config files
- **Opt-in**: Chỉ hoạt động khi được bật trong config

## 📋 Implementation Plan

### Phase 1: Core Infrastructure (Week 1-2)

#### 1.1 RAG Provider Interface

```typescript
interface RagProvider {
  name: string
  initialize(config: RagConfig): Promise<void>
  search(query: string, options: SearchOptions): Promise<RagResult[]>
  index(documents: Document[]): Promise<void>
  isEnabled(): boolean
}
```

#### 1.2 Vector Store Abstraction

- Support Pinecone, Qdrant, Chroma
- Unified interface cho multiple vector DBs
- Connection pooling và error handling

#### 1.3 Configuration System

```typescript
interface RagConfig {
  enabled: boolean
  provider: 'confluence' | 'multi'
  vectorStore: {
    type: 'pinecone' | 'qdrant' | 'chroma'
    config: VectorStoreConfig
  }
  options: RagOptions
}
```

### Phase 2: Confluence RAG (Week 3-4)

#### 2.1 Confluence Connector

- Atlassian Confluence API integration
- Authentication: API token, OAuth
- Rate limiting và error handling
- Support Confluence Cloud & Server

#### 2.2 Document Processing

- HTML to markdown conversion
- Metadata extraction (author, last modified, labels)
- Chunking strategy cho Confluence pages
- Incremental indexing

#### 2.3 Search & Retrieval

- Semantic search với vector similarity
- Hybrid search (keyword + semantic)
- Result ranking và filtering
- Citation tracking

### Phase 3: RAG Options System (Week 5-6)

#### 3.1 Multi-RAG Manager

```typescript
class RagManager {
  private providers: Map<string, RagProvider> = new Map()

  async addProvider(name: string, provider: RagProvider): Promise<void>
  async search(query: string, config: RagSearchConfig): Promise<RagResult[]>
  async getEnabledProviders(): Promise<string[]>
}
```

#### 3.2 Preset Configurations

```json
// config/rag-presets.json
{
  "confluence-only": {
    "providers": ["confluence"],
    "vectorStore": "pinecone",
    "chunkSize": 1000,
    "overlap": 200
  },
  "multi-source": {
    "providers": ["confluence", "web", "files"],
    "vectorStore": "qdrant",
    "rerank": true,
    "maxResults": 10
  }
}
```

#### 3.3 UI Integration

- RAG toggle trong chat interface
- Provider selection dropdown
- Config panel cho advanced users

### Phase 4: Integration & Testing (Week 7-8)

#### 4.1 Chat Flow Integration

```typescript
// lib/actions/chat.ts - Enhancement
export async function enhanceWithRag(
  message: string,
  ragConfig: RagConfig
): Promise<EnhancedMessage> {
  if (!ragConfig.enabled) return { original: message }

  const ragResults = await ragManager.search(message, ragConfig)
  return {
    original: message,
    ragContext: ragResults,
    enhanced: combineMessageWithRag(message, ragResults)
  }
}
```

#### 4.2 Environment Variables

```bash
# .env.local
RAG_ENABLED=true
RAG_PROVIDERS=confluence
RAG_VECTOR_STORE=pinecone
CONFLUENCE_BASE_URL=https://company.atlassian.net
CONFLUENCE_API_TOKEN=your_token
PINECONE_API_KEY=your_key
```

#### 4.3 Error Handling & Monitoring

- Graceful degradation khi RAG fails
- Logging và metrics
- Health checks cho vector stores

## 🔧 Technical Requirements

### Dependencies Mới

```json
{
  "@pinecone-database/pinecone": "^2.0.0",
  "@qdrant/js-client-rest": "^1.7.0",
  "chroma-js": "^2.4.2",
  "atlassian-connect": "^1.0.0",
  "turndown": "^7.1.2",
  "langchain": "^0.1.0"
}
```

### Database Schema (Optional)

```sql
-- rag_documents table nếu cần tracking
CREATE TABLE rag_documents (
  id UUID PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  external_id VARCHAR(255),
  content TEXT,
  metadata JSONB,
  indexed_at TIMESTAMP DEFAULT NOW()
);
```

## ✅ Acceptance Criteria

### Functional

- [ ] Confluence RAG: Search trong company docs
- [ ] Multi-option RAG: Switch giữa các preset
- [ ] Zero impact: Không ảnh hưởng logic hiện tại
- [ ] Config-driven: Enable/disable via env vars

### Performance

- [ ] < 2s response time cho RAG search
- [ ] < 100ms cho non-RAG queries
- [ ] Proper caching strategies

### Reliability

- [ ] Error handling không break main flow
- [ ] Retry logic cho external APIs
- [ ] Monitoring và alerting

### Security

- [ ] API keys encrypted
- [ ] Access control cho Confluence data
- [ ] Rate limiting implemented

## 🚀 Rollout Plan

1. **Week 1-2**: Core infrastructure + Confluence basic
2. **Week 3-4**: Confluence full implementation
3. **Week 5-6**: RAG options system
4. **Week 7-8**: Integration, testing, documentation
5. **Week 9**: Beta testing với internal users
6. **Week 10**: Production deployment

## 📊 Success Metrics

- RAG accuracy: > 85% relevant results
- Performance: < 3s end-to-end latency
- Adoption: > 50% queries sử dụng RAG
- Error rate: < 5% RAG failures
- User satisfaction: > 4.5/5 rating

## 🔍 Risk Mitigation

- **Risk**: Vector DB performance → Solution: Multi-provider support
- **Risk**: Confluence API limits → Solution: Caching + batch processing
- **Risk**: Breaking changes → Solution: Feature flags + gradual rollout
- **Risk**: Security concerns → Solution: Audit logging + access controls

---

_Planning created for Codex AI implementation. Ensure all new code follows Darin's coding standards and testing requirements._
