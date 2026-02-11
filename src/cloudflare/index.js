
import { handleRequest } from '../shared/parser.js';

export default {
    async fetch(request, env, ctx) {
        const result = await handleRequest(request.url);

        // Convert { status, body, headers } to Response object
        return new Response(result.body, {
            status: result.status,
            headers: result.headers || {}
        });
    },
};
