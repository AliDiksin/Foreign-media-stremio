const { addonBuilder, serveHTTP } = require('stremio-addon-sdk')
const { getCatalogContent, getApiKey } = require('./lib/tmdb')

// Sort options available for all catalogs
const SORT_OPTIONS = ['Top', 'Popular', 'New']

// Extra configuration for catalogs (sorting + pagination)
const catalogExtra = [
    {
        name: 'genre',
        options: SORT_OPTIONS,
        isRequired: false
    },
    {
        name: 'skip',
        isRequired: false
    }
]

// Addon manifest
const manifest = {
    id: 'com.foreign-content.addon.v5',
    version: '1.0.4',
    name: 'Foreign Movies & TV v5',
    description: 'Browse non-English content: Indian, Arab, and all Foreign films & TV shows. Sort by Top, Popular, or New.',
    
    resources: ['catalog'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    
    catalogs: [
        // Movie Catalogs
        {
            type: 'movie',
            id: 'indian-movies',
            name: 'Indian Movies',
            extra: catalogExtra
        },
        {
            type: 'movie',
            id: 'arab-movies',
            name: 'Arab Movies',
            extra: catalogExtra
        },
        {
            type: 'movie',
            id: 'foreign-movies',
            name: 'Foreign Movies',
            extra: catalogExtra
        },
        
        // TV Series Catalogs
        {
            type: 'series',
            id: 'indian-series',
            name: 'Indian TV',
            extra: catalogExtra
        },
        {
            type: 'series',
            id: 'arab-series',
            name: 'Arab TV',
            extra: catalogExtra
        },
        {
            type: 'series',
            id: 'foreign-series',
            name: 'Foreign TV',
            extra: catalogExtra
        }
    ],
    
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Flag_of_South_Korea.svg/125px-Flag_of_South_Korea.svg.png',
    background: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1280',
    
    behaviorHints: {
        adult: false,
        p2p: false
    }
}

// Create the addon builder
const builder = new addonBuilder(manifest)

// Define the catalog handler
builder.defineCatalogHandler(async function(args) {
    console.log(`[Addon] Catalog request: ${args.type}/${args.id}`, args.extra)
    
    try {
        // Get sort option from genre extra (Stremio uses 'genre' for dropdown options)
        const sortOption = args.extra?.genre || 'Top'
        
        // Get skip for pagination
        const skip = parseInt(args.extra?.skip) || 0
        
        // Fetch catalog content
        const metas = await getCatalogContent(args.id, args.type, sortOption, skip)
        
        return {
            metas: metas,
            cacheMaxAge: 3600, // Cache for 1 hour
            staleRevalidate: 7200, // Allow stale content for 2 hours while revalidating
            staleError: 86400 // Allow stale content for 1 day if error
        }
    } catch (error) {
        console.error(`[Addon] Catalog error:`, error.message)
        return { metas: [] }
    }
})

// Server configuration
const PORT = process.env.PORT || 7004

// Initialize and start the server
async function startServer() {
    try {
        // Pre-fetch API key to verify it works
        console.log('[Addon] Initializing TMDB API connection...')
        await getApiKey()
        
        // Start the HTTP server
        serveHTTP(builder.getInterface(), { 
            port: PORT,
            cacheMaxAge: 3600
        })
        
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   Foreign Movies & TV v5 is running!                         ║
║                                                              ║
║   Local:    http://127.0.0.1:${PORT}/manifest.json              ║
║                                                              ║
║   Catalogs:                                                  ║
║   • Indian Movies & TV                                       ║
║   • Arab Movies & TV                                         ║
║   • All Foreign Movies & TV                                  ║
║                                                              ║
║   Sorting: Top | Popular | New                               ║
║                                                              ║
║   To install in Stremio:                                     ║
║   1. Open Stremio                                            ║
║   2. Go to Addons                                            ║
║   3. Enter: http://127.0.0.1:${PORT}/manifest.json              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
        `)
    } catch (error) {
        console.error('[Addon] Failed to start server:', error.message)
        process.exit(1)
    }
}

// Start the server
startServer()
