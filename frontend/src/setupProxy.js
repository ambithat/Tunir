// const { createProxyMiddleware } = require('http-proxy-middleware');

// module.exports = function (app) {
//   const backendTarget = process.env.REACT_APP_BACKEND_URL || 'http://192.168.1.114:5004';

//   const proxyOptions = {
//     target: backendTarget,
//     changeOrigin: true,
//     cookieDomainRewrite: "",
//     secure: false,
//     ws: false,
//     timeout: 0,
//     proxyTimeout: 0,
//     headers: {
//       Connection: 'keep-alive',
//     },
//     pathFilter: ['/api', '/sales', '/statustype'],
//   };

//   app.use(createProxyMiddleware(proxyOptions));
// };




// const { createProxyMiddleware } = require('http-proxy-middleware');

// module.exports = function (app) {
//   const backendTarget = process.env.REACT_APP_BACKEND_URL || 'http://192.168.1.114:5004';

//   const proxyOptions = {
//     target: backendTarget,
//     changeOrigin: true,
//     cookieDomainRewrite: "", // Prevents proxy from overriding/altering cookie domain
//     secure: false,
//     ws: false,
//     timeout: 0,
//     proxyTimeout: 0,
//     headers: {
//       Connection: 'keep-alive',
//     },
//     // Ensure cookies are forwarded on incoming request & returned on response
//     onProxyReq: (proxyReq, req, res) => {
//       if (req.headers.cookie) {
//         proxyReq.setHeader('cookie', req.headers.cookie);
//       }
//     },
//     onProxyRes: (proxyRes, req, res) => {
//       // Allow cookies to be set across localhost/local network IPs
//       if (proxyRes.headers['set-cookie']) {
//         proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie =>
//           cookie.replace(/Domain=[^;]+;?/i, '')
//         );
//       }
//     },
//   };

//   app.use(['/api', '/sales', '/statustype'], createProxyMiddleware(proxyOptions));
// };

const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Dynamically resolve target backend URL from environment variables.
 * Supports: REACT_APP_BACKEND_URL, REACT_APP_API_URL, REACT_APP_BACKEND_IP, REACT_APP_API_HOST, BACKEND_URL, etc.
 * Formats plain IPs (e.g., "192.168.1.142" or "192.168.1.142:8000") into full http:// origins.
 */
function resolveBackendTarget() {
  const envVal =
    process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_API_URL ||
    process.env.REACT_APP_BACKEND_IP ||
    process.env.REACT_APP_API_HOST ||
    process.env.REACT_APP_SERVER_URL ||
    process.env.BACKEND_URL ||
    process.env.BACKEND_IP;

  const defaultIp = 'http://192.168.1.222:8000';

  if (!envVal || !envVal.trim()) {
    return defaultIp;
  }

  let clean = envVal.trim();

  // Prepend http:// if user entered plain IP or domain without protocol
  if (!/^https?:\/\//i.test(clean)) {
    clean = `http://${clean}`;
  }

  try {
    const parsed = new URL(clean);
    const hostParts = parsed.host.split(':');
    const hostname = hostParts[0];
    const port = hostParts[1] || '8000';
    return `${parsed.protocol}//${hostname}:${port}`;
  } catch (_) {
    return clean;
  }
}

module.exports = function (app) {
  const backendTarget = resolveBackendTarget();
  console.log(`[Proxy Setup] 🚀 Target Backend API Server: ${backendTarget}`);

  const rewriteDevCookie = (cookie) =>
    cookie
      .replace(/;\s*Domain=[^;]*/i, '')
      .replace(/;\s*Secure/i, '')
      .replace(/;\s*SameSite=None/i, '; SameSite=Lax');

  app.use(
    createProxyMiddleware({
      pathFilter: ['/api', '/sales', '/statustype'],
      target: backendTarget,
      changeOrigin: true,
      secure: false,
      timeout: 60000,
      cookieDomainRewrite: '',
      on: {
        proxyReq: (proxyReq, req) => {
          if (req.headers.cookie) {
            proxyReq.setHeader('cookie', req.headers.cookie);
          }
        },
        proxyRes: (proxyRes) => {
          const setCookie = proxyRes.headers['set-cookie'];
          if (setCookie) {
            proxyRes.headers['set-cookie'] = setCookie.map(rewriteDevCookie);
          }
        },
        error: (err, req, res) => {
          console.error(`[proxy] ${req.method} ${req.url} -> ${backendTarget} failed:`, err.message);
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
          }
          res.end(JSON.stringify({ detail: 'Backend proxy failed', error: err.message }));
        },
      },
    })
  );
};

