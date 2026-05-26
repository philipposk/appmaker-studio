/**
 * CRA dev-server middleware.
 *
 * WebContainer requires the page that boots it to be served with
 * Cross-Origin-Opener-Policy: same-origin AND
 * Cross-Origin-Embedder-Policy: require-corp
 * (a.k.a. "cross-origin isolated" mode). Without these headers,
 * `WebContainer.boot()` throws.
 *
 * react-scripts has no built-in way to set response headers, so we
 * inject them via setupProxy.js.
 */
module.exports = function setupProxy(app) {
  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  });
};
