# Frizi Local SEO Marketplace Foundation

Frizi Client uses server-rendered public pages for search engines and keeps the logged-in app as the Vite client experience.

## Current launch market

The initial combined market is:

- Kitchener
- Waterloo
- Cambridge
- Guelph

The geography layer is reusable. New Canadian cities should be added to `cityPages` in `api/_seo-content.mjs` and only added to the launch sitemap set when Frizi is ready to support them.

## Canonical URL model

Local discovery pages use city-first URLs:

- `/kitchener/barbers`
- `/waterloo/hair-stylists`
- `/cambridge/fine-hair-stylists`
- `/guelph/balayage`

Professional URLs are stable and person-owned:

- `/pro/[professional-public-slug]`

Salon URLs are stable and salon-owned:

- `/salon/[salon-public-slug]`

Older category-first discovery URLs may still resolve for compatibility, but their canonical URL points to the city-first path.

## Indexability rule

Do not index thin local pages.

Core professional-type pages need at least three matching public professionals:

- barbers
- hair stylists
- colourists

Specialty and service pages need at least two matching public professionals.

Pages below the threshold return useful human content and `noindex, follow`. They are not included in the sitemap.

## Inventory source

Public pages only use shared Frizi data:

- published and bookable professionals
- valid linked profile identity
- active booking-enabled location
- public services available to new clients

No fake professionals, fake reviews, or filler rankings are generated for SEO pages.

## Actions Center / Reserve with Google readiness

Google's current appointment-booking path is Actions Center Appointments Redirect. It requires partner onboarding, eligibility review, daily Entity/Action/Services feeds, sandbox testing, and attribution for bookings that come from Google.

Frizi is not ready to generate those feeds yet. The SEO foundation keeps the required data concepts aligned:

- stable professional and salon URLs
- canonical service taxonomy
- public location data
- public booking eligibility
- real services and future availability links

When Frizi pursues Actions Center, build a dedicated feed exporter against this canonical data rather than scraping rendered pages.
