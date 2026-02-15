const TRUE_VALUES = new Set(["1", "true", "yes", "si"]);

export function parsePagination(query = {}, options = {}) {
    const defaultLimit = Number(options.defaultLimit || 100);
    const maxLimit = Number(options.maxLimit || 500);

    const allRaw = String(query?.all ?? "").toLowerCase().trim();
    if (TRUE_VALUES.has(allRaw)) {
        return null;
    }

    const rawLimit = Number(query?.limit);
    const rawPage = Number(query?.page);
    const rawOffset = Number(query?.offset);

    const limit = Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), maxLimit)
        : defaultLimit;

    const page = Number.isFinite(rawPage) && rawPage > 0
        ? Math.floor(rawPage)
        : 1;

    const offset = Number.isFinite(rawOffset) && rawOffset >= 0
        ? Math.floor(rawOffset)
        : (page - 1) * limit;

    return { limit, page, offset };
}

