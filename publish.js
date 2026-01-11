const { publishToCentral } = require('stremio-addon-sdk')
const { getApiKey } = require('./lib/tmdb')

// Same manifest as addon.js
const SORT_OPTIONS = ['Top', 'Popular', 'New']

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

const manifest = {
    id: 'com.foreign-content.addon.v5',
    version: '1.0.4',
    name: 'Foreign Movies & TV v5',
    description: 'Browse non-English content: Indian, Arab, and all Foreign films & TV shows. Sort by Top, Popular, or New.',
    
    resources: ['catalog'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    
    catalogs: [
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

async function publish() {
    try {
        console.log('[Publish] Verifying TMDB API connection...')
        await getApiKey()
        
        console.log('[Publish] Publishing to BeamUp...')
        console.log('[Publish] Note: You need to provide a URL where the addon is already running.')
        console.log('')
        
        // BeamUp requires the addon to be accessible at a public URL
        // It will then cache and serve it from their CDN
        const addonUrl = process.argv[2]
        
        if (!addonUrl) {
            console.log('Usage: node publish.js <addon-url>')
            console.log('')
            console.log('Example:')
            console.log('  node publish.js https://your-addon.example.com/manifest.json')
            console.log('')
            console.log('To deploy to BeamUp, you can use their serverless option:')
            console.log('  1. Run: npx stremio-addon-sdk publish')
            console.log('  2. Follow the prompts')
            console.log('')
            process.exit(1)
        }
        
        await publishToCentral(addonUrl)
        console.log('[Publish] Successfully published to Stremio Central!')
        
    } catch (error) {
        console.error('[Publish] Failed:', error.message)
        process.exit(1)
    }
}

publish()
