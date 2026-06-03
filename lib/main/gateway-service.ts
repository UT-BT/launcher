import { getGatewayConfig } from './config'
import https from 'https'
import http from 'http'
import { URL } from 'url'

const REQUEST_TIMEOUT_MS = 20_000
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024

export interface GatewayRequestOptions {
  endpoint: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: string | Buffer
  requiresAuth?: boolean
}

export class GatewayService {
  private static instance: GatewayService

  public static getInstance(): GatewayService {
    if (!GatewayService.instance) {
      GatewayService.instance = new GatewayService()
    }
    return GatewayService.instance
  }

  public getUrl(endpoint: string): string {
    const config = getGatewayConfig()
    const baseUrl = config.baseUrl.replace(/\/$/, '')
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${baseUrl}${cleanEndpoint}`
  }

  public getHeaders(requiresAuth: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'UTBT-Launcher'
    }

    if (requiresAuth) {
      const config = getGatewayConfig()
      if (config.apiKey) {
        headers['X-Api-Key'] = config.apiKey
      }
    }

    return headers
  }

  public async request<T = any>(options: GatewayRequestOptions): Promise<T> {
    const url = this.getUrl(options.endpoint)
    const headers = {
      ...this.getHeaders(options.requiresAuth),
      ...options.headers
    }

    return new Promise((resolve, reject) => {
      const visited = new Set<string>()

      const doRequest = (requestUrl: string) => {
        if (visited.has(requestUrl)) {
          return reject(new Error('Redirect loop detected'))
        }
        visited.add(requestUrl)

        const parsed = new URL(requestUrl)
        const client = parsed.protocol === 'https:' ? https : http

        const requestOptions = {
          method: options.method || 'GET',
          headers,
          timeout: REQUEST_TIMEOUT_MS,
        }

        const req = client.request(requestUrl, requestOptions, (res) => {
          const status = res.statusCode || 0

          if (status >= 300 && status < 400 && res.headers.location) {
            res.destroy()
            const nextUrl = new URL(res.headers.location, requestUrl).toString()
            return doRequest(nextUrl)
          }

          if (status < 200 || status >= 300) {
            res.destroy()
            return reject(new Error(`Request failed with status ${status}`))
          }

          const chunks: Buffer[] = []
          let received = 0
          res.on('data', (chunk) => {
            received += chunk.length
            if (received > MAX_RESPONSE_BYTES) {
              res.destroy()
              reject(new Error('Response exceeded maximum allowed size'))
              return
            }
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          })

          res.on('end', () => {
            try {
              const buffer = Buffer.concat(chunks)
              const text = buffer.toString('utf-8')

              let result: any
              try {
                result = JSON.parse(text)
              } catch {
                result = text
              }

              resolve(result)
            } catch (error) {
              reject(error)
            }
          })

          res.on('error', reject)
        })

        req.on('error', reject)
        req.on('timeout', () => req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`)))

        if (options.body) {
          req.write(options.body)
        }

        req.end()
      }

      doRequest(url)
    })
  }

  public async get<T = any>(endpoint: string, requiresAuth: boolean = false): Promise<T> {
    return this.request<T>({
      endpoint,
      method: 'GET',
      requiresAuth
    })
  }

  public async post<T = any>(endpoint: string, data?: any, requiresAuth: boolean = false): Promise<T> {
    return this.request<T>({
      endpoint,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      requiresAuth
    })
  }

  public async downloadBuffer(endpoint: string, requiresAuth: boolean = false): Promise<Buffer> {
    const url = this.getUrl(endpoint)
    const headers = this.getHeaders(requiresAuth)

    return new Promise((resolve, reject) => {
      const visited = new Set<string>()

      const doGet = (requestUrl: string) => {
        if (visited.has(requestUrl)) {
          return reject(new Error('Redirect loop detected'))
        }
        visited.add(requestUrl)

        const parsed = new URL(requestUrl)
        const client = parsed.protocol === 'https:' ? https : http

        client.get(requestUrl, { headers }, (res) => {
          const status = res.statusCode || 0

          if (status >= 300 && status < 400 && res.headers.location) {
            const nextUrl = new URL(res.headers.location, requestUrl).toString()
            return doGet(nextUrl)
          }

          if (status !== 200) {
            return reject(new Error(`Download failed with status ${status}`))
          }

          const chunks: Buffer[] = []
          res.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          })

          res.on('end', () => resolve(Buffer.concat(chunks)))
          res.on('error', reject)
        }).on('error', reject)
      }

      doGet(url)
    })
  }
}

export const gatewayService = GatewayService.getInstance()
