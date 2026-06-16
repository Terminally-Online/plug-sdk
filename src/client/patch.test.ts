import { describe, expect, it } from 'vitest'

import { applyJsonPatch, type JsonPatchOperation } from './patch'

describe('applyJsonPatch', () => {
    const cases: { name: string; doc: unknown; ops: JsonPatchOperation[]; want: unknown }[] = [
        { name: 'add object member', doc: { a: 1 }, ops: [{ op: 'add', path: '/b', value: 2 }], want: { a: 1, b: 2 } },
        { name: 'replace member', doc: { a: 1 }, ops: [{ op: 'replace', path: '/a', value: 9 }], want: { a: 9 } },
        { name: 'remove member', doc: { a: 1, b: 2 }, ops: [{ op: 'remove', path: '/b' }], want: { a: 1 } },
        { name: 'add array element', doc: { a: [1, 2] }, ops: [{ op: 'add', path: '/a/1', value: 9 }], want: { a: [1, 9, 2] } },
        { name: 'append with dash', doc: { a: [1] }, ops: [{ op: 'add', path: '/a/-', value: 2 }], want: { a: [1, 2] } },
        { name: 'remove array element', doc: { a: [1, 2, 3] }, ops: [{ op: 'remove', path: '/a/1' }], want: { a: [1, 3] } },
        { name: 'replace array element', doc: { a: [1, 2] }, ops: [{ op: 'replace', path: '/a/0', value: 9 }], want: { a: [9, 2] } },
        { name: 'nested replace', doc: { a: { b: { c: 1 } } }, ops: [{ op: 'replace', path: '/a/b/c', value: 2 }], want: { a: { b: { c: 2 } } } },
        { name: 'move', doc: { a: 1, b: { c: 2 } }, ops: [{ op: 'move', from: '/a', path: '/b/d' }], want: { b: { c: 2, d: 1 } } },
        { name: 'copy', doc: { a: 1, b: {} }, ops: [{ op: 'copy', from: '/a', path: '/b/c' }], want: { a: 1, b: { c: 1 } } },
        {
            name: 'escaped pointer ~1 and ~0',
            doc: { 'a/b': 1, 'c~d': 2 },
            ops: [
                { op: 'replace', path: '/a~1b', value: 9 },
                { op: 'replace', path: '/c~0d', value: 8 },
            ],
            want: { 'a/b': 9, 'c~d': 8 },
        },
        { name: 'whole-doc replace', doc: { a: 1 }, ops: [{ op: 'replace', path: '', value: { z: 9 } }], want: { z: 9 } },
        {
            name: 'sequence of ops',
            doc: { n: 0, items: [] as string[] },
            ops: [
                { op: 'replace', path: '/n', value: 1 },
                { op: 'add', path: '/items/-', value: 'x' },
            ],
            want: { n: 1, items: ['x'] },
        },
    ]

    for (const c of cases) {
        it(c.name, () => {
            expect(applyJsonPatch(c.doc, c.ops)).toEqual(c.want)
        })
    }

    it('passes a satisfied test op', () => {
        const out = applyJsonPatch({ a: 1 }, [
            { op: 'test', path: '/a', value: 1 },
            { op: 'replace', path: '/a', value: 2 },
        ])
        expect(out).toEqual({ a: 2 })
    })

    it('throws on a failed test op', () => {
        expect(() => applyJsonPatch({ a: 1 }, [{ op: 'test', path: '/a', value: 5 }])).toThrow()
    })

    it('does not mutate the input document', () => {
        const doc = { a: 1, nested: { b: 2 } }
        applyJsonPatch(doc, [{ op: 'replace', path: '/nested/b', value: 9 }])
        expect(doc).toEqual({ a: 1, nested: { b: 2 } })
    })

    it('returns a new reference', () => {
        const doc = { a: 1 }
        const out = applyJsonPatch(doc, [{ op: 'add', path: '/b', value: 2 }])
        expect(out).not.toBe(doc)
    })
})
