export type SSEMessage = {
    event?: string
    data: string
    id?: string
    retry?: number
    comment?: string
}

const parseEventBlock = (block: string): SSEMessage | null => {
    if (block === '') return null

    let event: string | undefined
    let id: string | undefined
    let retry: number | undefined
    const dataLines: string[] = []
    const comments: string[] = []

    for (const line of block.split('\n')) {
        if (line === '') continue
        if (line[0] === ':') {
            comments.push(line.slice(1).replace(/^ /, ''))
            continue
        }

        const colon = line.indexOf(':')
        const field = colon === -1 ? line : line.slice(0, colon)
        let value = colon === -1 ? '' : line.slice(colon + 1)
        if (value[0] === ' ') value = value.slice(1)

        switch (field) {
            case 'event':
                event = value
                break
            case 'data':
                dataLines.push(value)
                break
            case 'id':
                id = value
                break
            case 'retry': {
                const n = Number(value)
                if (!Number.isNaN(n)) retry = n
                break
            }
        }
    }

    return {
        event,
        id,
        retry,
        data: dataLines.join('\n'),
        comment: comments.length > 0 ? comments.join('\n') : undefined,
    }
}

export async function* parseSSEStream(
    stream: ReadableStream<Uint8Array>,
    signal?: AbortSignal,
): AsyncGenerator<SSEMessage> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const onAbort = () => {
        reader.cancel().catch(() => {})
    }
    signal?.addEventListener('abort', onAbort)

    try {
        while (true) {
            const { value, done } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n')

            let delimiter = buffer.indexOf('\n\n')
            while (delimiter !== -1) {
                const block = buffer.slice(0, delimiter)
                buffer = buffer.slice(delimiter + 2)
                const message = parseEventBlock(block)
                if (message) yield message
                delimiter = buffer.indexOf('\n\n')
            }
        }
    } finally {
        signal?.removeEventListener('abort', onAbort)
        reader.releaseLock()
    }
}
