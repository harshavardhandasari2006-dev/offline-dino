const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Optional lightweight .env and .env.local loader (no external dependencies)
function loadEnv() {
  const envFiles = ['.env', '.env.local'];
  for (const envFile of envFiles) {
    const fullPath = path.join(__dirname, envFile);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch (e) {
        // Ignore read errors
      }
    }
  }
}

loadEnv();

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json'
};

const ROOT_DIR = __dirname;

function requestHandler(req, res) {
  let reqPath = req.url.split('?')[0];
  try {
    reqPath = decodeURIComponent(reqPath);
  } catch (e) {
    // Keep raw reqPath on decode failure
  }

  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(ROOT_DIR, safePath);

  // Security check: ensure file is within ROOT_DIR
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // HTTP Range request support (essential for HTML5 video streaming and seeking)
    const range = req.headers.range;
    if (range && stats.size > 0) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

      if (start >= stats.size || end >= stats.size || start > end) {
        res.writeHead(416, {
          'Content-Range': `bytes */${stats.size}`
        });
        res.end();
        return;
      }

      const chunksize = (end - start) + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    // Strict zero-cache headers for instant updates during development
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function getNetworkAddresses() {
  const nets = os.networkInterfaces();
  const results = [];
  const virtualRegex = /(vmware|virtualbox|vbox|vethernet|wsl|loopback|tap|hyper-v)/i;

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Non-internal IPv4 and not APIPA (169.254.x.x)
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        const isVirtual = virtualRegex.test(name);
        results.push({
          name,
          address: net.address,
          isVirtual,
          isWifi: /wi-?fi|wlan/i.test(name)
        });
      }
    }
  }

  // Prioritize physical Wi-Fi/Ethernet adapters over virtual bridges
  results.sort((a, b) => {
    if (a.isVirtual !== b.isVirtual) return a.isVirtual ? 1 : -1;
    if (a.isWifi !== b.isWifi) return a.isWifi ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return results;
}

const HOST = process.env.HOST || process.env.HOSTNAME || '0.0.0.0';
const PORTS = [3000, 3001];

function startServer() {
  const activeServers = [];
  PORTS.forEach((port) => {
    const server = http.createServer(requestHandler);
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[WARN] Port ${port} is currently in use.`);
      } else {
        console.error(`[ERROR] Server on port ${port}:`, err.message);
      }
    });
    server.listen(port, HOST, () => {
      console.log(`  ▲ OFFLINE DINO live at http://localhost:${port}`);
      activeServers.push(server);
    });
  });

  const cleanup = () => {
    activeServers.forEach(s => s.close());
    process.exit(0);
  };
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);
}

startServer();
