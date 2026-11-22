import http from 'http';
import fs from 'fs';
import path from 'path';

export function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0];
      const filePath = path.join(rootDir, cleanUrl === '/' ? 'index.html' : cleanUrl);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      const mime = ext === '.html' ? 'text/html; charset=utf-8'
        : ext === '.json' ? 'application/json; charset=utf-8'
        : ext === '.js' || ext === '.mjs' ? 'application/javascript; charset=utf-8'
        : 'text/plain; charset=utf-8';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

export async function isolatePage(page, errors) {
  // Neutralize native blocking dialogs
  await page.addInitScript(() => {
    window.alert = () => {};
    window.confirm = () => true;
    window.prompt = () => '115';
  });

  // Strict network isolation: abort any external request outside localhost / 127.0.0.1 / data / blob
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (
      url.startsWith('http://127.0.0.1') ||
      url.startsWith('http://localhost') ||
      url.startsWith('data:') ||
      url.startsWith('blob:')
    ) {
      route.continue();
    } else {
      route.abort();
    }
  });

  page.on('pageerror', (err) => errors.pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // Ignore expected aborted external requests in isolated mode
      if (!txt.includes('net::ERR_FAILED') && !txt.includes('Failed to fetch')) {
        errors.consoleErrors.push(txt);
      }
    }
  });
}
