import { parseSSEStream, type SSEMessage } from './sse'
import type { JsonPatchOperation } from './patch'

export type StreamStatus = 'connecting' | 'live' | 'reconnecting' | 'offline' | 'error'

export type StreamCallbacks = {
    onSnapshot: (data: unknown) => void
    onPatch: (ops: JsonPatchOperation[]) => void
    onStatus?: (status: StreamStatus) => void
    onError?: (error: Error) => void
}

export type StreamConnectionOptions = StreamCallbacks & {
    url: string
    getAuthHeaders: () => Promise<Record<string, string>>
    onTokenExpired?: () => Promise<string | null>
    validateSnapshot?: (data: unknown) => unknown
    heartbeatTimeoutMs?: number
    baseRetryMs?: number
    maxRetryMs?: number
}

class FatalStreamError extends Error {}

const toError = (value: unknown): Error => (value instanceof Error ? value : new Error(String(value)))

const safeJsonParse = (raw: string): unknown => {
    try {
        return JSON.parse(raw)
    } catch {
        return undefined
    }
}

export class StreamConnection {
    private readonly options: Required<
        Pick<StreamConnectionOptions, 'heartbeatTimeoutMs' | 'baseRetryMs' | 'maxRetryMs'>
    > &
        StreamConnectionOptions

    private closed = false
    private status: StreamStatus = 'connecting'
    private attempt = 0
    private lastEventId?: string
    private serverRetryMs?: number
    private controller?: AbortController
    private heartbeatTimer?: ReturnType<typeof setTimeout>

    constructor(options: StreamConnectionOptions) {
        this.options = {
            heartbeatTimeoutMs: 45000,
            baseRetryMs: 1000,
            maxRetryMs: 30000,
            ...options,
        }
    }

    open(): void {
        if (this.controller || this.closed) return
        void this.loop()
    }

    close(): void {
        if (this.closed) return
        this.closed = true
        this.clearHeartbeat()
        this.controller?.abort()
        this.setStatus('offline')
    }

    private async loop(): Promise<void> {
        while (!this.closed) {
            this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting')
            try {
                await this.connectOnce()
            } catch (error) {
                if (this.closed) break
                if (error instanceof FatalStreamError) {
                    this.setStatus('error')
                    this.options.onError?.(toError(error))
                    break
                }
            }
            if (this.closed) break
            this.setStatus('reconnecting')
            await this.backoff()
        }
    }

    private async connectOnce(): Promise<void> {
        const controller = new AbortController()
        this.controller = controller

        const headers: Record<string, string> = {
            Accept: 'text/event-stream',
            ...(await this.options.getAuthHeaders()),
        }
        if (this.lastEventId) headers['Last-Event-ID'] = this.lastEventId

        let response = await fetch(this.options.url, { headers, signal: controller.signal })

        if (response.status === 401 && this.options.onTokenExpired) {
            const token = await this.options.onTokenExpired()
            if (token) {
                headers.Authorization = `Bearer ${token}`
                response = await fetch(this.options.url, { headers, signal: controller.signal })
            }
        }

        if (response.status === 401 || response.status === 403) {
            throw new FatalStreamError(`stream auth failed: ${response.status}`)
        }
        if (!response.ok || !response.body) {
            throw new Error(`stream failed: ${response.status}`)
        }

        this.attempt = 0
        this.setStatus('live')
        this.armHeartbeat(controller)

        try {
            for await (const message of parseSSEStream(response.body, controller.signal)) {
                this.armHeartbeat(controller)
                this.dispatch(message)
            }
        } finally {
            this.clearHeartbeat()
        }
    }

    private dispatch(message: SSEMessage): void {
        if (message.retry !== undefined) this.serverRetryMs = message.retry
        if (message.id) this.lastEventId = message.id

        switch (message.event) {
            case 'snapshot': {
                const data = safeJsonParse(message.data)
                this.options.onSnapshot(this.options.validateSnapshot ? this.options.validateSnapshot(data) : data)
                return
            }
            case 'patch': {
                const ops = safeJsonParse(message.data)
                if (Array.isArray(ops)) this.options.onPatch(ops as JsonPatchOperation[])
                return
            }
            case 'error':
                this.options.onError?.(new Error(message.data || 'stream error'))
                return
            case 'reconnect':
            case 'reauth':
                this.controller?.abort()
                return
        }
    }

    private armHeartbeat(controller: AbortController): void {
        this.clearHeartbeat()
        this.heartbeatTimer = setTimeout(() => controller.abort(), this.options.heartbeatTimeoutMs)
    }

    private clearHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearTimeout(this.heartbeatTimer)
            this.heartbeatTimer = undefined
        }
    }

    private backoff(): Promise<void> {
        const base = this.serverRetryMs ?? this.options.baseRetryMs
        const capped = Math.min(this.options.maxRetryMs, base * 2 ** this.attempt)
        const jitter = capped * 0.2 * (Math.random() * 2 - 1)
        this.attempt += 1
        return new Promise((resolve) => setTimeout(resolve, Math.max(0, capped + jitter)))
    }

    private setStatus(status: StreamStatus): void {
        if (this.status === status) return
        this.status = status
        this.options.onStatus?.(status)
    }
}
