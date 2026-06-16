import { PlugSDKError } from '../types'

export type JsonPatchOperation = {
    op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test'
    path: string
    from?: string
    value?: unknown
}

const unescapeToken = (token: string): string => token.replace(/~1/g, '/').replace(/~0/g, '~')

const parsePointer = (pointer: string): string[] => {
    if (pointer === '') return []
    if (pointer.charCodeAt(0) !== 47) {
        throw new PlugSDKError(`invalid JSON pointer: ${pointer}`, 'PATCH_FAILED')
    }
    return pointer.slice(1).split('/').map(unescapeToken)
}

const deepEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
        return a.every((v, i) => deepEqual(v, b[i]))
    }
    const ak = Object.keys(a as object)
    const bk = Object.keys(b as object)
    if (ak.length !== bk.length) return false
    return ak.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

const getValue = (doc: unknown, tokens: string[]): unknown => {
    let node: unknown = doc
    for (const token of tokens) {
        if (node === null || typeof node !== 'object') {
            throw new PlugSDKError(`path not found: /${tokens.join('/')}`, 'PATCH_FAILED')
        }
        node = Array.isArray(node) ? node[Number(token)] : (node as Record<string, unknown>)[token]
    }
    return node
}

const applyOne = (root: unknown, op: JsonPatchOperation): unknown => {
    const tokens = parsePointer(op.path)

    if (tokens.length === 0) {
        switch (op.op) {
            case 'add':
            case 'replace':
                return op.value
            case 'remove':
                return undefined
            case 'test':
                if (!deepEqual(root, op.value)) throw new PlugSDKError('test failed at root', 'PATCH_FAILED')
                return root
            case 'move':
            case 'copy':
                return getValue(root, parsePointer(op.from ?? ''))
        }
    }

    if (op.op === 'move') {
        const value = getValue(root, parsePointer(op.from ?? ''))
        const removed = applyOne(root, { op: 'remove', path: op.from ?? '' })
        return applyOne(removed, { op: 'add', path: op.path, value })
    }

    const key = tokens[tokens.length - 1]
    const parent = getValue(root, tokens.slice(0, -1))
    if (parent === null || typeof parent !== 'object') {
        throw new PlugSDKError(`cannot apply ${op.op} at ${op.path}`, 'PATCH_FAILED')
    }

    const isArray = Array.isArray(parent)
    const arr = parent as unknown[]
    const obj = parent as Record<string, unknown>
    const index = key === '-' ? arr.length : Number(key)

    switch (op.op) {
        case 'add':
            if (isArray) arr.splice(index, 0, op.value)
            else obj[key] = op.value
            return root
        case 'copy':
            if (isArray) arr.splice(index, 0, structuredClone(getValue(root, parsePointer(op.from ?? ''))))
            else obj[key] = structuredClone(getValue(root, parsePointer(op.from ?? '')))
            return root
        case 'replace':
            if (isArray) arr[index] = op.value
            else obj[key] = op.value
            return root
        case 'remove':
            if (isArray) arr.splice(index, 1)
            else delete obj[key]
            return root
        case 'test':
            if (!deepEqual(isArray ? arr[index] : obj[key], op.value)) {
                throw new PlugSDKError(`test failed at ${op.path}`, 'PATCH_FAILED')
            }
            return root
    }

    return root
}

export const applyJsonPatch = <T>(doc: T, ops: JsonPatchOperation[]): T => {
    let root: unknown = structuredClone(doc)
    for (const op of ops) {
        root = applyOne(root, op)
    }
    return root as T
}
