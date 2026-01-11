const axios = require('axios')
const freekeys = require('freekeys')

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'
const CINEMETA_BASE_URL = 'https://v3-cinemeta.strem.io'

// How many pages to fetch per language for foreign catalog
const PAGES_PER_LANGUAGE = 2

// How many pages to fetch for specific language catalogs
const PAGES_TO_FETCH = 5

// Cache for API key and IMDB ID mappings
let cachedApiKey = null
const imdbIdCache = new Map()
const cinemetaCache = new Map()

// Get TMDB API key via freekeys
async function getApiKey() {
    if (cachedApiKey) {
        return cachedApiKey
    }
    
    try {
        const keys = await freekeys()
        cachedApiKey = keys.tmdb_key
        console.log('[TMDB] API key obtained successfully')
        return cachedApiKey
    } catch (error) {
        console.error('[TMDB] Failed to get API key:', error.message)
        throw error
    }
}

// Sort mapping for movies
const MOVIE_SORT_MAP = {
    'Top': 'popularity.desc',
    'Popular': 'popularity.desc',
    'New': 'primary_release_date.desc'
}

// Sort mapping for TV shows
const TV_SORT_MAP = {
    'Top': 'popularity.desc',
    'Popular': 'popularity.desc',
    'New': 'first_air_date.desc'
}

// Language configurations for specific catalogs
const LANGUAGE_CONFIG = {
    'korean': { with_original_language: 'ko' },
    'indian': { with_original_language: 'hi|ta|te|bn|mr|ml|pa|gu|kn' },
    'arab': { with_original_language: 'ar' },
    'foreign': { isForeign: true } // Special flag for combined non-English content
}

// Languages to include in the "foreign" catalog (all non-English)
const FOREIGN_LANGUAGES = [
    'ko',  // Korean
    'hi',  // Hindi
    'ja',  // Japanese
    'zh',  // Chinese
    'es',  // Spanish
    'fr',  // French
    'de',  // German
    'it',  // Italian
    'pt',  // Portuguese
    'ru',  // Russian
    'ar',  // Arabic
    'ta',  // Tamil
    'te',  // Telugu
    'th',  // Thai
    'tr',  // Turkish
    'pl',  // Polish
    'nl',  // Dutch
    'sv',  // Swedish
    'id',  // Indonesian
    'vi',  // Vietnamese
    'bn',  // Bengali
    'ml',  // Malayalam
    'mr',  // Marathi
    'pa',  // Punjabi
    'fa',  // Persian
    'he',  // Hebrew
    'el',  // Greek
    'cs',  // Czech
    'hu',  // Hungarian
    'ro',  // Romanian
    'uk',  // Ukrainian
]

const ANIMATION_GENRE_ID = 16
const ADULT_TITLE_REGEX = /(?:\bsex\b|\berotic\b|porn|xxx|softcore|nude|adult|bdsm|fetish|lust|sexy|explicit|성인|에로|야한|섹스|포르노|노출|19금|청불)/i

function getReleaseCutoffDate() {
    const date = new Date()
    date.setMonth(date.getMonth() - 6)
    return date.toISOString().split('T')[0]
}

// Discover movies from TMDB (single page, single language)
async function discoverMoviesPage(language, sortOption, page = 1) {
    const apiKey = await getApiKey()
    const sortBy = MOVIE_SORT_MAP[sortOption] || MOVIE_SORT_MAP['Top']
    
    const params = {
        api_key: apiKey,
        sort_by: sortBy,
        page: page,
        include_adult: false,
        include_video: false,
        with_original_language: language,
        without_genres: ANIMATION_GENRE_ID,
        'primary_release_date.lte': getReleaseCutoffDate()
    }
    
    try {
        const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, { params })
        return response.data.results || []
    } catch (error) {
        return []
    }
}

// Discover TV from TMDB (single page, single language)
async function discoverTVPage(language, sortOption, page = 1) {
    const apiKey = await getApiKey()
    const sortBy = TV_SORT_MAP[sortOption] || TV_SORT_MAP['Top']
    
    const params = {
        api_key: apiKey,
        sort_by: sortBy,
        page: page,
        include_adult: false,
        include_null_first_air_dates: false,
        with_original_language: language,
        without_genres: ANIMATION_GENRE_ID,
        'first_air_date.lte': getReleaseCutoffDate()
    }
    
    try {
        const response = await axios.get(`${TMDB_BASE_URL}/discover/tv`, { params })
        return response.data.results || []
    } catch (error) {
        return []
    }
}

// Fetch movies for a specific language catalog (Korean, Indian, Arab)
async function discoverMoviesForLanguage(languageConfig, sortOption, startPage = 1) {
    const languages = languageConfig.split('|')
    const allItems = []
    
    for (const lang of languages) {
        for (let page = startPage; page < startPage + PAGES_TO_FETCH; page++) {
            const items = await discoverMoviesPage(lang, sortOption, page)
            allItems.push(...items)
        }
    }
    
    console.log(`[TMDB] Fetched ${allItems.length} movies for language config`)
    return allItems
}

// Fetch TV for a specific language catalog
async function discoverTVForLanguage(languageConfig, sortOption, startPage = 1) {
    const languages = languageConfig.split('|')
    const allItems = []
    
    for (const lang of languages) {
        for (let page = startPage; page < startPage + PAGES_TO_FETCH; page++) {
            const items = await discoverTVPage(lang, sortOption, page)
            allItems.push(...items)
        }
    }
    
    console.log(`[TMDB] Fetched ${allItems.length} TV shows for language config`)
    return allItems
}

// Fetch movies for the FOREIGN catalog (all non-English languages combined)
async function discoverForeignMovies(sortOption, startPage = 1) {
    const allItems = []
    
    // Fetch from each language in parallel (batched to avoid rate limits)
    const batchSize = 10
    for (let i = 0; i < FOREIGN_LANGUAGES.length; i += batchSize) {
        const batch = FOREIGN_LANGUAGES.slice(i, i + batchSize)
        const promises = batch.map(lang => 
            discoverMoviesPage(lang, sortOption, startPage)
        )
        const results = await Promise.all(promises)
        results.forEach(items => allItems.push(...items))
    }
    
    // Also fetch page 2 for top languages to get more content
    const topLanguages = ['ko', 'hi', 'ja', 'zh', 'es', 'fr', 'de', 'ar', 'ta', 'te']
    const page2Promises = topLanguages.map(lang => 
        discoverMoviesPage(lang, sortOption, startPage + 1)
    )
    const page2Results = await Promise.all(page2Promises)
    page2Results.forEach(items => allItems.push(...items))
    
    console.log(`[TMDB] Fetched ${allItems.length} foreign movies from ${FOREIGN_LANGUAGES.length} languages`)
    return allItems
}

// Fetch TV for the FOREIGN catalog
async function discoverForeignTV(sortOption, startPage = 1) {
    const allItems = []
    
    // Fetch from each language in parallel (batched)
    const batchSize = 10
    for (let i = 0; i < FOREIGN_LANGUAGES.length; i += batchSize) {
        const batch = FOREIGN_LANGUAGES.slice(i, i + batchSize)
        const promises = batch.map(lang => 
            discoverTVPage(lang, sortOption, startPage)
        )
        const results = await Promise.all(promises)
        results.forEach(items => allItems.push(...items))
    }
    
    // Also fetch page 2 for top languages
    const topLanguages = ['ko', 'hi', 'ja', 'zh', 'es', 'fr', 'de', 'ar', 'ta', 'te']
    const page2Promises = topLanguages.map(lang => 
        discoverTVPage(lang, sortOption, startPage + 1)
    )
    const page2Results = await Promise.all(page2Promises)
    page2Results.forEach(items => allItems.push(...items))
    
    console.log(`[TMDB] Fetched ${allItems.length} foreign TV shows from ${FOREIGN_LANGUAGES.length} languages`)
    return allItems
}

// Get IMDB ID for a movie or TV show
async function getImdbId(tmdbId, type) {
    const cacheKey = `${type}:${tmdbId}`
    
    if (imdbIdCache.has(cacheKey)) {
        return imdbIdCache.get(cacheKey)
    }
    
    const apiKey = await getApiKey()
    const endpoint = type === 'movie' 
        ? `${TMDB_BASE_URL}/movie/${tmdbId}/external_ids`
        : `${TMDB_BASE_URL}/tv/${tmdbId}/external_ids`
    
    try {
        const response = await axios.get(endpoint, {
            params: { api_key: apiKey }
        })
        
        const imdbId = response.data.imdb_id
        imdbIdCache.set(cacheKey, imdbId || null)
        return imdbId
    } catch (error) {
        imdbIdCache.set(cacheKey, null)
        return null
    }
}

// Batch fetch IMDB IDs
async function batchGetImdbIds(items, type) {
    const batchSize = 20
    const results = []
    
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        const batchResults = await Promise.all(
            batch.map(async (item) => {
                const imdbId = await getImdbId(item.id, type)
                return { ...item, imdb_id: imdbId }
            })
        )
        results.push(...batchResults)
    }
    
    return results.filter(item => item.imdb_id)
}

async function fetchCinemetaMeta(imdbId, type) {
    const cacheKey = `${type}:${imdbId}`

    if (cinemetaCache.has(cacheKey)) {
        return cinemetaCache.get(cacheKey)
    }

    try {
        const response = await axios.get(`${CINEMETA_BASE_URL}/meta/${type}/${imdbId}.json`)
        const meta = response.data && response.data.meta ? response.data.meta : null
        cinemetaCache.set(cacheKey, meta)
        return meta
    } catch (error) {
        cinemetaCache.set(cacheKey, null)
        return null
    }
}

async function batchGetCinemetaMetas(imdbIds, type) {
    const batchSize = 10
    const metaMap = new Map()

    for (let i = 0; i < imdbIds.length; i += batchSize) {
        const batch = imdbIds.slice(i, i + batchSize)
        const batchResults = await Promise.all(
            batch.map(async (imdbId) => ({
                imdbId,
                meta: await fetchCinemetaMeta(imdbId, type)
            }))
        )
        batchResults.forEach(result => metaMap.set(result.imdbId, result.meta))
    }

    return metaMap
}

// Convert TMDB movie to Stremio Meta
function movieToMeta(movie) {
    return {
        id: movie.imdb_id,
        type: 'movie',
        name: movie.title || movie.original_title,
        poster: movie.poster_path 
            ? `${TMDB_IMAGE_BASE}/w500${movie.poster_path}`
            : null,
        background: movie.backdrop_path
            ? `${TMDB_IMAGE_BASE}/w1280${movie.backdrop_path}`
            : null,
        posterShape: 'poster',
        description: movie.overview || '',
        releaseInfo: movie.release_date 
            ? movie.release_date.substring(0, 4)
            : '',
        imdbRating: movie.vote_average 
            ? movie.vote_average.toFixed(1)
            : null
    }
}

// Convert TMDB TV to Stremio Meta
function tvToMeta(tv) {
    return {
        id: tv.imdb_id,
        type: 'series',
        name: tv.name || tv.original_name,
        poster: tv.poster_path 
            ? `${TMDB_IMAGE_BASE}/w500${tv.poster_path}`
            : null,
        background: tv.backdrop_path
            ? `${TMDB_IMAGE_BASE}/w1280${tv.backdrop_path}`
            : null,
        posterShape: 'poster',
        description: tv.overview || '',
        releaseInfo: tv.first_air_date 
            ? tv.first_air_date.substring(0, 4)
            : '',
        imdbRating: tv.vote_average 
            ? tv.vote_average.toFixed(1)
            : null
    }
}

function isAnimatedContent(item) {
    return Array.isArray(item.genre_ids) && item.genre_ids.includes(ANIMATION_GENRE_ID)
}

function isAdultishContent(item) {
    const text = [
        item.title,
        item.original_title,
        item.name,
        item.original_name,
        item.overview
    ].filter(Boolean).join(' ')

    return ADULT_TITLE_REGEX.test(text)
}

// Main function to get catalog content
async function getCatalogContent(catalogId, type, sortOption, skip = 0) {
    const languageKey = catalogId.replace('-movies', '').replace('-series', '')
    const langConfig = LANGUAGE_CONFIG[languageKey]
    
    // Calculate page from skip
    const startPage = Math.floor(skip / 100) + 1
    
    let items = []
    let converter
    
    if (type === 'movie') {
        converter = movieToMeta
        
        if (langConfig.isForeign) {
            // Foreign catalog - fetch from all non-English languages
            items = await discoverForeignMovies(sortOption, startPage)
        } else {
            // Specific language catalog
            items = await discoverMoviesForLanguage(langConfig.with_original_language, sortOption, startPage)
        }
    } else {
        converter = tvToMeta
        
        if (langConfig.isForeign) {
            items = await discoverForeignTV(sortOption, startPage)
        } else {
            items = await discoverTVForLanguage(langConfig.with_original_language, sortOption, startPage)
        }
    }
    
    // Filter to only items with posters and exclude animation/adult-ish content
    items = items.filter(item => item.poster_path)
        .filter(item => !isAnimatedContent(item) && !isAdultishContent(item))
    
    // Sort by popularity/rating combo, popularity, or release date
    if (sortOption === 'Top') {
        items.sort((a, b) => {
            const scoreA = (a.popularity || 0) + (a.vote_average || 0) * 10
            const scoreB = (b.popularity || 0) + (b.vote_average || 0) * 10
            return scoreB - scoreA
        })
    } else if (sortOption === 'Popular') {
        items.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    } else if (sortOption === 'New') {
        items.sort((a, b) => {
            const dateA = a.release_date || a.first_air_date || ''
            const dateB = b.release_date || b.first_air_date || ''
            return dateB.localeCompare(dateA)
        })
    }
    
    // Fetch IMDB IDs (limit to top 250 for performance)
    const contentType = type === 'movie' ? 'movie' : 'tv'
    const cinemetaType = type === 'movie' ? 'movie' : 'series'
    items = await batchGetImdbIds(items.slice(0, 250), contentType)
    
    const imdbIds = items.map(item => item.imdb_id)
    const cinemetaMap = await batchGetCinemetaMetas(imdbIds, cinemetaType)

    // Convert to Stremio format (prefer Cinemeta, fallback to TMDB)
    const metas = items.map(item => {
        const cinemetaMeta = cinemetaMap.get(item.imdb_id)
        if (cinemetaMeta) {
            return {
                ...cinemetaMeta,
                id: item.imdb_id,
                type: cinemetaType
            }
        }
        return converter(item)
    }).filter(meta => meta.id && meta.poster)
    
    // Remove duplicates
    const seen = new Set()
    const uniqueMetas = metas.filter(meta => {
        if (seen.has(meta.id)) return false
        seen.add(meta.id)
        return true
    })
    
    console.log(`[Catalog] Returning ${uniqueMetas.length} items for ${catalogId} (sort: ${sortOption}, skip: ${skip})`)
    
    return uniqueMetas
}

module.exports = {
    getApiKey,
    getCatalogContent,
    LANGUAGE_CONFIG
}
