import { PineconeVectorStore } from '@/lib/rag/vector-store/pinecone'
import { QdrantVectorStore } from '@/lib/rag/vector-store/qdrant'
import { ChromaVectorStore } from '@/lib/rag/vector-store/chroma'
import type { VectorStore, VectorStoreType, VectorStoreConfig } from '@/lib/rag/types/rag'

export function createVectorStore(
  type: VectorStoreType,
  config: VectorStoreConfig
): VectorStore {
  switch (type) {
    case 'pinecone':
      return new PineconeVectorStore(config)
    case 'qdrant':
      return new QdrantVectorStore(config)
    case 'chroma':
      return new ChromaVectorStore(config)
    default:
      throw new Error(`Unsupported vector store type: ${type satisfies never}`)
  }
}
