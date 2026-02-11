
const { handleRequest } = require('../shared/parser.js');

/**
 * Huawei FunctionGraph Node.js Handler
 * Entry point: index.handler
 */
exports.handler = async (event, context) => {
    // APIG trigger provides query parameters in event.queryStringParameters
    const params = event.queryStringParameters || event.query || {};

    // Construct a mock URL for handleRequest
    // It expects a full URL string to parse searchParams
    const mockUrl = new URL('http://localhost');
    for (const [key, value] of Object.entries(params)) {
        mockUrl.searchParams.set(key, value);
    }

    try {
        const result = await handleRequest(mockUrl.toString());

        return {
            statusCode: result.status,
            headers: result.headers || { 'Content-Type': 'text/plain' },
            body: result.body,
            isBase64Encoded: false
        };
    } catch (err) {
        console.error('Handler error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};

/**
 * Local HTTP server for development
 * usage: node src/huawei/index.js
 */
if (require.main === module) {
    const http = require('http');
    const PORT = process.env.PORT || 8787;

    const server = http.createServer(async (req, res) => {
        const protocol = req.socket.encrypted ? 'https' : 'http';
        const host = req.headers.host;
        const fullUrl = new URL(req.url, `${protocol}://${host}`);

        try {
            const result = await handleRequest(fullUrl.toString());

            res.statusCode = result.status;
            if (result.headers) {
                for (const [key, value] of Object.entries(result.headers)) {
                    res.setHeader(key, value);
                }
            }
            res.end(result.body);
        } catch (err) {
            console.error('Development server error:', err);
            res.statusCode = 500;
            res.end('Internal Server Error');
        }
    });

    server.listen(PORT, () => {
        console.log(`Local development server running at http://localhost:${PORT}/`);
        console.log(`Usage: http://localhost:${PORT}/?url=YOUR_SUB_LINK`);
    });
}
