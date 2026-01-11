const { addonBuilder } = require('stremio-addon-sdk')
const { getCatalogContent, getApiKey } = require('../lib/tmdb')

// Sort options
const SORT_OPTIONS = ['Top', 'Popular', 'New']

const catalogExtra = [
    { name: 'genre', options: SORT_OPTIONS, isRequired: false },
    { name: 'skip', isRequired: false }
]

// Manifest
const manifest = {
    id: 'com.foreign-content.addon.v5',
    version: '1.0.4',
    name: 'Foreign Movies & TV',
    description: 'Browse non-English content: Indian, Arab, and all Foreign films & TV shows. Sort by Top, Popular, or New.',
    resources: ['catalog'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: [
        { type: 'movie', id: 'indian-movies', name: 'Indian Movies', extra: catalogExtra },
        { type: 'movie', id: 'arab-movies', name: 'Arab Movies', extra: catalogExtra },
        { type: 'movie', id: 'foreign-movies', name: 'Foreign Movies', extra: catalogExtra },
        { type: 'series', id: 'indian-series', name: 'Indian TV', extra: catalogExtra },
        { type: 'series', id: 'arab-series', name: 'Arab TV', extra: catalogExtra },
        { type: 'series', id: 'foreign-series', name: 'Foreign TV', extra: catalogExtra }
    ],
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Flag_of_South_Korea.svg/125px-Flag_of_South_Korea.svg.png',
    background: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1280',
    behaviorHints: { adult: false, p2p: false }
}

const builder = new addonBuilder(manifest)

builder.defineCatalogHandler(async function(args) {
    try {
        const sortOption = args.extra?.genre || 'Top'
        const skip = parseInt(args.extra?.skip) || 0
        const metas = await getCatalogContent(args.id, args.type, sortOption, skip)
        return { metas }
    } catch (error) {
        console.error('[Addon] Error:', error.message)
        return { metas: [] }
    }
})

const addonInterface = builder.getInterface()

module.exports = async (req, res) => {
    const url = req.url

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Content-Type', 'application/json')

    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    try {
        // Parse the path
        const path = url.replace(/^\/|\/$/g, '')

        if (path === 'manifest.json' || path === '') {
            res.json(addonInterface.manifest)
            return
        }

        // Handle catalog requests: catalog/{type}/{id}.json or catalog/{type}/{id}/{extra}.json
        const catalogMatch = path.match(/^catalog\/(\w+)\/([^/]+)(\/([^/]+))?\.json$/)
        if (catalogMatch) {
            const type = catalogMatch[1]
            const id = catalogMatch[2]
            const extraStr = catalogMatch[4] || ''

            // Parse extra params
            const extra = {}
            if (extraStr) {
                extraStr.split('&').forEach(pair => {
                    const [key, value] = pair.split('=')
                    if (key && value) extra[key] = decodeURIComponent(value)
                })
            }

            const result = await addonInterface.catalog({ type, id, extra })
            res.json(result)
            return
        }

        // Not found
        res.status(404).json({ error: 'Not found' })

    } catch (error) {
        console.error('[Vercel] Error:', error)
        res.status(500).json({ error: error.message })
    }
}
