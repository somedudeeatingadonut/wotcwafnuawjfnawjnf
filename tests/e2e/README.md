# End-to-end browser tests

Both tests drive the real app in headless Chromium via puppeteer-core.

Setup (sandbox-friendly, no Playwright/CDN):

    mkdir -p /tmp/br/e2e && cd /tmp/br/e2e
    npm pack @sparticuz/chromium puppeteer-core
    npm init -y && npm install ./sparticuz-chromium-*.tgz ./puppeteer-core-*.tgz
    # chromium binary extracts itself on first executablePath() call;
    # al2023 libs: brotli-decompress node_modules/@sparticuz/chromium/bin/al2023.tar.br -> /tmp/al2023

Run (server must be up: `PORT=8080 node server.mjs`):

    # fallback path: pollinations totally unreachable
    LD_LIBRARY_PATH=/tmp/al2023/lib node offline.mjs

    # simulated user environment: images reachable but slow (6s),
    # text POST /openai dead (502), legacy GET works
    LD_LIBRARY_PATH=/tmp/al2023/lib node mock-remote.mjs

Copy these from tests/e2e into the puppeteer dir before running (module resolution).
