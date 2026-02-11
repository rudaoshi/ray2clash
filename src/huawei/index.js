
const { handleRequest } = require('../shared/parser.js');

/**
 * Huawei FunctionGraph Node.js Handler
 * Entry point: index.handler
 */
async function handler(event, context) {
    console.log('FunctionGraph handler started');

    // APIG trigger provides query parameters in event.queryStringParameters
    // Some triggers might use event.query
    const params = event.queryStringParameters || event.query || {};

    console.log('Params:', JSON.stringify(params));

    if (!params.url) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            body: 'Missing "url" query parameter. Usage: /?url=YOUR_SUB_LINK'
        };
    }

    try {
        // Construct a mock URL for handleRequest
        const mockUrl = new URL('http://localhost');
        for (const [key, value] of Object.entries(params)) {
            mockUrl.searchParams.set(key, value);
        }

        const result = await handleRequest(mockUrl.toString());

        return {
            statusCode: result.status,
            headers: result.headers || { 'Content-Type': 'text/yaml; charset=utf-8' },
            body: result.body,
            isBase64Encoded: false
        };
    } catch (err) {
        console.error('Handler error:', err);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: err.message })
        };
    }
}

// Explicit export for Huawei FunctionGraph
module.exports = {
    handler: handler
};

/**
 * Note: Local development server moved to a separate file or 
 * you can run this file if you add the check back, but 
 * for the build we'll keep it simple to avoid issues.
 */
