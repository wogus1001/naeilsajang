const SEARCH_TERM_DELIMITER_REGEX = /[\s,，]+/;

export function parseSearchTerms(input: string): string[] {
    return input
        .toLowerCase()
        .split(SEARCH_TERM_DELIMITER_REGEX)
        .map(term => term.trim())
        .filter(Boolean);
}
