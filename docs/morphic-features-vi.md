# Tổng quan Darin

- Công cụ tìm kiếm AI với giao diện Generative UI, hiểu câu hỏi ngôn ngữ tự nhiên và chọn chế độ tìm (Quick, Planning, Adaptive).
- Hỗ trợ nhiều nhà cung cấp AI (OpenAI mặc định, Anthropic Claude, Google Gemini, Vercel AI Gateway, Ollama) và tùy chỉnh cấu hình model trong `config/models/`.
- Nhiều nhà cung cấp tìm kiếm (Tavily, Brave, SearXNG tự host, Exa, Firecrawl) kèm khả năng trích xuất nội dung URL, theo dõi citation và lưu trữ cache.
- Giao diện lựa chọn ưu tiên tốc độ/chất lượng model, thanh tra quá trình gọi tool, và nút chuyển chế độ tìm kiếm.

## Xác thực và người dùng

- Đăng nhập qua Supabase Auth; có thể tắt bắt buộc đăng nhập với `ENABLE_AUTH=false` cho môi trường cá nhân.
- Hỗ trợ ẩn danh khi tắt auth; cảnh báo khi chạy trong môi trường cloud với auth tắt.

## Chat, lịch sử và tệp

- Lưu lịch sử hội thoại vào PostgreSQL, hỗ trợ chia sẻ kết quả qua URL riêng.
- Phản hồi người dùng trên tin nhắn (feedback) để cải thiện kết quả.
- Tải tệp (JPEG/PNG/PDF) lên Cloudflare R2 (tùy chọn), kết nối theo từng chat và người dùng.

## Khả năng tìm kiếm và RAG

- Tìm theo URL cụ thể hoặc tìm web tổng quát; có chế độ tự lên kế hoạch tác vụ.
- Trích xuất nội dung bằng Tavily hoặc Jina; theo dõi và hiển thị citation trong kết quả.
- RAG tùy chọn: tích hợp Confluence với vector store (Pinecone, Qdrant, Chroma) qua preset `config/rag-presets.json` và biến `RAG_*`.
- Script `scripts/index-confluence-space.ts` để ingest không gian Confluence; chế độ tìm kiếm Confluence chỉ dùng ngữ cảnh đã lập chỉ mục.

## Hạ tầng và triển khai

- Next.js App Router, TypeScript, Tailwind + shadcn/ui + Radix UI, Drizzle ORM cho PostgreSQL, Redis cho cache SearXNG, Cloudflare R2 cho lưu tệp.
- Chạy cục bộ với Bun (`bun dev`), hoặc Docker Compose (Postgres, Redis, SearXNG, app) kèm migrate tự động.
- Triển khai Vercel (nên bật auth) hoặc Docker image có sẵn trên GHCR; hỗ trợ cấu hình bằng `.env.local` và preset.

## Theo dõi và tiện ích

- Tùy chọn ghi nhận LLM observability với Langfuse.
- Theo dõi changelog, bộ todo cho tác vụ phức tạp, và preset model được bundle sẵn khi build.
