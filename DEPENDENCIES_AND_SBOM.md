# Dependencies and SBOM

Audit date: 2026-08-14

Client package: `frizi-client`
- Runtime: React, Vite, TypeScript, Supabase JS/SSR, Stripe, lucide-react, Tailwind utilities.
- `npm audit --audit-level=moderate`: clean after non-force `npm audit fix`.
- Build: passed.
- Tests: 12/12 passed.

Professional package: `frizi-pro-landing`
- Runtime: React, Vite, TypeScript, Supabase JS, Stripe, qrcode, lucide-react.
- `npm audit --audit-level=moderate`: clean after non-force `npm audit fix`.
- Build: passed.
- Tests: no `test` script exists.

Open supply-chain tasks:
- Add automated dependency audit in CI.
- Pin Vercel CLI version in deployment automation.
- Generate machine-readable SBOM with a tool such as CycloneDX before broader launch.
- Add SAST/secret scanning in GitHub.

