const axios = require('axios')

const REAL_DEBRID_API_KEY = process.env.REAL_DEBRID_API_KEY

// YTS API endpoint for searching movies by IMDB ID
const YTS_BASE_URL = 'https://yts.mx/api/v2/list_movies.json'

// Real Debrid API endpoint for checking instant availability
const RD_BASE_URL = 'https://api.real-debrid.com/rest/1.0'

// Concurrency limit to avoid rate limiting
const CONCURRENCY = 3

async function searchYTSForMovie(imdbId) {
    try {
        const response = await axios.get(YTS_BASE_URL, {
            params: { query_term: imdbId },
            timeout: 8000
        })

        const movies = response.data?.data?.movies || []
        const hashes = []

        for (const movie of movies) {
            for (const torrent of movie.torrents || []) {
                if (torrent.hash) {
                    hashes.push(torrent.hash.toLowerCase())
                }
            }
        }

        return hashes
    } catch (error) {
        console.error(`[YTS] Error searching ${imdbId}:`, error.message)
        return []
    }
}

async function checkRDAvailability(hashes) {
    if (hashes.length === 0) return false

    try {
        // RD allows up to 50 hashes per request
        const hashString = hashes.slice(0, 50).join('/')
        const response = await axios.get(
            `${RD_BASE_URL}/torrents/instantAvailability/${hashString}`,
            {
                headers: { Authorization: `Bearer ${REAL_DEBRID_API_KEY}` },
                timeout: 10000
            }
        )

        const data = response.data || {}
        // If any hash has RD data, the movie is available
        return Object.keys(data).some(hash => {
            const hashData = data[hash]
            return hashData && Object.keys(hashData).length > 0
        })
    } catch (error) {
        console.error(`[RD] Error checking availability:`, error.message)
        return false
    }
}

async function isMovieAvailable(imdbId) {
    if (!REAL_DEBRID_API_KEY) return true

    const hashes = await searchYTSForMovie(imdbId)
    if (hashes.length === 0) return false

    return await checkRDAvailability(hashes)
}

async function filterMoviesByAvailability(items) {
    if (!REAL_DEBRID_API_KEY) {
        console.log('[RD] No REAL_DEBRID_API_KEY set, skipping Real Debrid filter')
        return items
    }

    console.log(`[RD] Checking availability for ${items.length} movies...`)
    const results = []

    for (let i = 0; i < items.length; i += CONCURRENCY) {
        const batch = items.slice(i, i + CONCURRENCY)
        const checks = await Promise.all(
            batch.map(async (item) => {
                const available = await isMovieAvailable(item.imdb_id)
                return { item, available }
            })
        )

        for (const { item, available } of checks) {
            if (available) results.push(item)
        }
    }

    console.log(`[RD] Filtered ${items.length} movies down to ${results.length} available on Real Debrid`)
    return results
}

async function filterTVByAvailability(items) {
    if (!REAL_DEBRID_API_KEY) return items

    // TV shows require episode-specific torrent checking.
    // Without knowing season/episode numbers, we can't reliably check Real Debrid cache status.
    // For now, we pass TV shows through. Real Debrid stream addons handle per-episode filtering.
    console.log('[RD] TV show Real Debrid filtering skipped (requires episode-specific torrent data)')
    return items
}

module.exports = {
    filterMoviesByAvailability,
    filterTVByAvailability
}
