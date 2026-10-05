#!/usr/bin/env node
/**
 * Zero-dependency static server for AI World Maker.
 *
 *   node server.mjs            # listens on 0.0.0.0:$PORT (default 8080)
 *
 * Notes:
 *  - Missing files return 404 (the app probes assets and falls back gracefully).
 *  - .js/.mjs are served as text/javascript so ES modules work.
 *  - Text assets are gzipped when the client accepts it.
 */
import http from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || process.env.EB_PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8'
};

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt']);

function send(res, status, headers, body) {
    res.writeHead(status, headers);
    if (body) res.end(body);
    else res.end();
}

async function handler(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';

        const filePath = path.normalize(path.join(ROOT, pathname));
        if (!filePath.startsWith(ROOT)) {
            send(res, 403, { 'Content-Type': 'text/plain' }, 'Forbidden');
            return;
        }

        let stat;
        try {
            stat = await fs.stat(filePath);
        } catch {
            send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found');
            return;
        }
        if (stat.isDirectory()) {
            send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const type = MIME[ext] || 'application/octet-stream';
        const headers = {
            'Content-Type': type,
            'Content-Length': stat.size,
            'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
            'X-Content-Type-Options': 'nosniff'
        };

        const acceptsGzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
        if (acceptsGzip && COMPRESSIBLE.has(ext) && stat.size > 1024) {
            const buf = await fs.readFile(filePath);
            const gz = zlib.gzipSync(buf, { level: 6 });
            headers['Content-Length'] = gz.length;
            headers['Content-Encoding'] = 'gzip';
            res.writeHead(200, headers);
            res.end(gz);
            return;
        }

        res.writeHead(200, headers);
        createReadStream(filePath).pipe(res);
    } catch (err) {
        console.error('Request error:', err);
        send(res, 500, { 'Content-Type': 'text/plain' }, 'Internal Server Error');
    }
}

http.createServer(handler).listen(PORT, HOST, () => {
    console.log(`AI World Maker server listening on http://${HOST}:${PORT}`);
});
