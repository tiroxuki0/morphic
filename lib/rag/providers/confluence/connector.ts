const RATE_LIMIT_STATUS = 429

export interface ConfluenceConnectorOptions {
  baseUrl: string
  authType?: 'apiToken' | 'oauth'
  email?: string
  apiToken?: string
  oauthToken?: string
  maxRetries?: number
  requestTimeoutMs?: number
}

export type ConfluencePage = {
  id: string
  title: string
  body?: {
    storage?: {
      value: string
    }
  }
  history?: {
    createdBy?: {
      publicName?: string
      email?: string
    }
    lastUpdated?: {
      when?: string
    }
  }
  version?: {
    when?: string
  }
  metadata?: Record<string, any>
  _links?: {
    webui?: string
  }
}

export interface SearchPageResponse {
  results: ConfluencePage[]
  size: number
  _links?: {
    next?: string
  }
}

export class ConfluenceAuthenticationError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'ConfluenceAuthenticationError'
  }
}

export class ConfluenceConnector {
  private options: ConfluenceConnectorOptions

  constructor(options: ConfluenceConnectorOptions) {
    this.options = {
      maxRetries: 3,
      requestTimeoutMs: 10_000,
      ...options
    }
    if (!this.options.baseUrl) {
      throw new Error('Confluence base URL is required')
    }
    this.options.baseUrl = this.normalizeBaseUrl(this.options.baseUrl)
  }

  getBaseUrl() {
    return this.options.baseUrl
  }

  async fetchPage(pageId: string): Promise<ConfluencePage> {
    return this.request(`/rest/api/content/${pageId}`, {
      searchParams: { expand: 'body.storage,history,version,metadata' }
    })
  }

  async searchPages(
    cql: string,
    limit = 25,
    cursor?: string
  ): Promise<SearchPageResponse> {
    const searchParams = cursor
      ? undefined
      : {
          cql,
          limit: String(limit),
          expand: 'body.storage,history,version,metadata'
        }

    if (cursor) {
      const url = new URL(cursor, this.options.baseUrl)
      return this.request(url.toString(), undefined, true)
    }

    return this.request('/rest/api/content/search', { searchParams })
  }

  private async request<T = any>(
    pathname: string,
    options?: { searchParams?: Record<string, string> },
    absolute = false
  ): Promise<T> {
    const url = absolute
      ? new URL(pathname)
      : new URL(
          `${this.options.baseUrl}${
            pathname.startsWith('/') ? '' : '/'
          }${pathname}`
        )
    if (
      url.hostname.endsWith('.atlassian.net') &&
      !url.pathname.startsWith('/wiki')
    ) {
      const normalizedPath = url.pathname.replace(/^\/+/, '')
      url.pathname = `/wiki/${normalizedPath}`
    }
    if (options?.searchParams) {
      for (const [key, value] of Object.entries(options.searchParams)) {
        url.searchParams.set(key, value)
      }
    }

    const headers = this.buildHeaders()
    const requestInit: RequestInit = {
      method: 'GET',
      headers
    }

    let attempt = 0
    while (attempt <= (this.options.maxRetries ?? 3)) {
      const controller = new AbortController()
      const timeout = setTimeout(
        () => controller.abort(),
        this.options.requestTimeoutMs
      )

      try {
        const response = await fetch(url, {
          ...requestInit,
          signal: controller.signal
        })

        if (response.status === RATE_LIMIT_STATUS) {
          await this.handleRateLimit(response, attempt)
          attempt++
          continue
        }

        if (response.status === 401 || response.status === 403) {
          const text = await response.text()
          throw new ConfluenceAuthenticationError(text, response.status)
        }

        if (!response.ok) {
          const text = await response.text()
          throw new Error(
            `Confluence API request failed: ${response.status} ${text} (url: ${url.toString()})`
          )
        }

        return (await response.json()) as T
      } catch (error) {
        if (attempt >= (this.options.maxRetries ?? 3)) {
          throw error
        }
        await this.backoff(attempt)
        attempt++
      } finally {
        clearTimeout(timeout)
      }
    }

    throw new Error('Confluence API request exceeded retries')
  }

  private normalizeBaseUrl(rawBaseUrl: string) {
    const url = new URL(rawBaseUrl)
    if (url.hostname.endsWith('.atlassian.net') && !url.pathname.includes('/wiki')) {
      url.pathname = '/wiki'
    }
    return url.toString().replace(/\/$/, '')
  }

  private buildHeaders() {
    if (this.options.authType === 'oauth' && this.options.oauthToken) {
      return {
        Authorization: `Bearer ${this.options.oauthToken}`
      }
    }

    if (!this.options.email || !this.options.apiToken) {
      throw new Error(
        'Confluence API token authentication requires email and token'
      )
    }

    const credentials = Buffer.from(
      `${this.options.email}:${this.options.apiToken}`
    ).toString('base64')
    return {
      Authorization: `Basic ${credentials}`
    }
  }

  private async handleRateLimit(response: Response, attempt: number) {
    const retryAfter =
      Number(response.headers.get('Retry-After')) || 2 ** attempt * 100
    await new Promise(resolve => setTimeout(resolve, retryAfter))
  }

  private async backoff(attempt: number) {
    const delay = Math.min(1000 * 2 ** attempt, 5000)
    await new Promise(resolve => setTimeout(resolve, delay))
  }
}
