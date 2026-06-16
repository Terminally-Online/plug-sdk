import { StreamConnection, type StreamCallbacks, type StreamStatus } from './stream'
import type { JsonPatchOperation } from './patch'

export type StreamListener = {
    onSnapshot?: (data: unknown) => void
    onPatch?: (ops: JsonPatchOperation[]) => void
    onStatus?: (status: StreamStatus) => void
    onError?: (error: Error) => void
}

type ManagedStream = {
    connection: StreamConnection
    listeners: Set<StreamListener>
    refCount: number
    lastSnapshot?: unknown
    hasSnapshot: boolean
    lastStatus: StreamStatus
    closeTimer?: ReturnType<typeof setTimeout>
}

export class StreamManager {
    private readonly streams = new Map<string, ManagedStream>()

    constructor(private readonly closeGraceMs = 5000) {}

    subscribe(
        key: string,
        create: (callbacks: StreamCallbacks) => StreamConnection,
        listener: StreamListener,
    ): () => void {
        let managed = this.streams.get(key)

        if (!managed) {
            const entry: ManagedStream = {
                connection: undefined as unknown as StreamConnection,
                listeners: new Set<StreamListener>(),
                refCount: 0,
                hasSnapshot: false,
                lastStatus: 'connecting',
            }
            entry.connection = create({
                onSnapshot: (data) => {
                    entry.lastSnapshot = data
                    entry.hasSnapshot = true
                    entry.listeners.forEach((l) => l.onSnapshot?.(data))
                },
                onPatch: (ops) => entry.listeners.forEach((l) => l.onPatch?.(ops)),
                onStatus: (status) => {
                    entry.lastStatus = status
                    entry.listeners.forEach((l) => l.onStatus?.(status))
                },
                onError: (error) => entry.listeners.forEach((l) => l.onError?.(error)),
            })
            this.streams.set(key, entry)
            managed = entry
            entry.connection.open()
        }

        if (managed.closeTimer) {
            clearTimeout(managed.closeTimer)
            managed.closeTimer = undefined
        }

        managed.listeners.add(listener)
        managed.refCount += 1

        if (managed.hasSnapshot) listener.onSnapshot?.(managed.lastSnapshot)
        listener.onStatus?.(managed.lastStatus)

        return () => this.unsubscribe(key, listener)
    }

    private unsubscribe(key: string, listener: StreamListener): void {
        const managed = this.streams.get(key)
        if (!managed) return

        if (managed.listeners.delete(listener)) managed.refCount -= 1

        if (managed.refCount <= 0) {
            managed.closeTimer = setTimeout(() => {
                managed.connection.close()
                this.streams.delete(key)
            }, this.closeGraceMs)
        }
    }
}
