
import { handleRequest } from './parser.js';

export default {
    async fetch(request, env, ctx) {
        const result = await handleRequest(request.url);

        return new Response(result.body, {
            status: result.status,
            headers: result.headers || {}
        });
    },
};
