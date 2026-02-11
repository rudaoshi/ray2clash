
import http from 'http';
import { handleRequest } from './parser.js';

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
        console.error('Server error:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
    }
});

server.listen(PORT, () => {
    console.log(`Local server running at http://localhost:${PORT}/`);
    console.log(`Usage: http://localhost:${PORT}/?url=YOUR_SUB_LINK`);
});
