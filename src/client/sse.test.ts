import { describe, expect, it } from 'vitest'

import { parseSSEStream, type SSEMessage } from './sse'

const streamFrom = (chunks: string[]): ReadableStream<Uint8Array> => {
    const encoder = new TextEncoder()
    let i = 0
    return new ReadableStream({
        pull(controller) {
            if (i < chunks.length) {
                controller.enqueue(encoder.encode(chunks[i++]))
            } else {
                controller.close()
            }
        },
    })
}

const collect = async (chunks: string[]): Promise<SSEMessage[]> => {
    const out: SSEMessage[] = []
    for await (const message of parseSSEStream(streamFrom(chunks))) out.push(message)
    return out
}

describe('parseSSEStream', () => {
    it('parses a snapshot event with id', async () => {
        const msgs = await collect(['event: snapshot\nid: e-1\ndata: {"a":1}\n\n'])
        expect(msgs).toHaveLength(1)
        expect(msgs[0].event).toBe('snapshot')
        expect(msgs[0].id).toBe('e-1')
        expect(msgs[0].data).toBe('{"a":1}')
    })

    it('reassembles an event split across chunks', async () => {
        const msgs = await collect(['event: pat', 'ch\ndata: [', '{"op":"replace"}]\n\n'])
        expect(msgs).toHaveLength(1)
        expect(msgs[0].event).toBe('patch')
        expect(msgs[0].data).toBe('[{"op":"replace"}]')
    })

    it('joins multi-line data with newlines', async () => {
        const msgs = await collect(['data: line1\ndata: line2\n\n'])
        expect(msgs[0].data).toBe('line1\nline2')
    })

    it('captures a heartbeat comment with empty data', async () => {
        const msgs = await collect([': heartbeat\n\n'])
        expect(msgs[0].comment).toBe('heartbeat')
        expect(msgs[0].data).toBe('')
    })

    it('captures a retry directive', async () => {
        const msgs = await collect(['retry: 3000\n\n'])
        expect(msgs[0].retry).toBe(3000)
    })

    it('handles CRLF line endings', async () => {
        const msgs = await collect(['event: snapshot\r\ndata: {"a":1}\r\n\r\n'])
        expect(msgs[0].event).toBe('snapshot')
        expect(msgs[0].data).toBe('{"a":1}')
    })

    it('parses multiple events from one chunk', async () => {
        const msgs = await collect(['event: a\ndata: 1\n\nevent: b\ndata: 2\n\n'])
        expect(msgs.map((m) => m.event)).toEqual(['a', 'b'])
    })
})
