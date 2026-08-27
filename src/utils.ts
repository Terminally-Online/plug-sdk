// A slot carries a chain of the slots it is chosen against — `{1=>2=>3<pool>}`
// goes three deep in the live library — and an index may be marked derived
// with a leading `~`. Only the index nearest the name addresses the values, so
// the whole prefix is skipped; reading a single `n=>` leaves every deeper slot
// unmatched and printed raw.
export const transformSentence = (sentence: string): string => {
    return sentence.replace(/\{(?:~?\d+=>)*~?(\d+)<([^>:]+)(?::[^>]+)?>\}/g, (_, index, content) => {
        const name = content.split(':')[0]
        return name || `{${index}}`
    })
}

export const formatActionName = (actionName: string): string => {
    return actionName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
}

export const getCommonPrefix = (sentences: string[]): string => {
    if (sentences.length === 0) return ""
    if (sentences.length === 1) return sentences[0]

    let prefix = ""
    const firstSentence = sentences[0]

    for (let i = 0; i < firstSentence.length; i++) {
        const char = firstSentence[i]
        if (sentences.every(sentence => sentence.toLowerCase()[i] === char.toLowerCase())) {
            prefix += char
        } else {
            break
        }
    }

    return prefix
}
