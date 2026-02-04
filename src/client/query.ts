const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const serializeArray = (params: URLSearchParams, prefix: string, arr: unknown[]): void => {
    arr.forEach((item, index) => {
        if (item === undefined || item === null) return

        const key = `${prefix}[${index}]`

        if (Array.isArray(item)) {
            // Nested array - items share the same key (no inner index)
            item.forEach((innerItem) => {
                if (innerItem !== undefined && innerItem !== null) {
                    params.append(key, innerItem.toString())
                }
            })
        } else if (isPlainObject(item)) {
            serializeObject(params, key, item)
        } else {
            params.append(key, item.toString())
        }
    })
}

const serializeObject = (params: URLSearchParams, prefix: string, obj: Record<string, unknown>): void => {
    for (const [subKey, subValue] of Object.entries(obj)) {
        if (subValue === undefined || subValue === null) continue

        const key = `${prefix}[${subKey}]`

        if (Array.isArray(subValue)) {
            serializeArray(params, key, subValue)
        } else if (isPlainObject(subValue)) {
            serializeObject(params, key, subValue)
        } else {
            params.append(key, subValue.toString())
        }
    }
}

export const buildQueryParams = <T extends Record<string, any>>(params: T): URLSearchParams => {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue

        if (isPlainObject(value)) {
            serializeObject(query, key, value)
        } else if (Array.isArray(value)) {
            serializeArray(query, key, value)
        } else {
            query.append(key, value.toString())
        }
    }

    return query
}
