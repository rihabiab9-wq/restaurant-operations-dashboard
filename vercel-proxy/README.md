# Clean hosted address

This small Vercel project uses an external rewrite to serve the live Restaurant Operations application under a `vercel.app` address without changing the URL in the browser. The app and its D1 database still run at the Sites origin. This is an address layer, not a migration of the backend.

Deploy this directory as the Vercel project root. Test the HTML, static assets, cookie-backed `/api/data`, and a write/read flow through the final `vercel.app` address. If cookie forwarding or asset routing fails, do not share the address; use a verified custom domain on the original Site or move the application and database together.

Vercel documents [external-origin rewrites](https://vercel.com/docs/routing/rewrites) as a reverse proxy pattern.
