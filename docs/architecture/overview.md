# Architecture Overview

Frizi Client is the client-facing web app. It should stay separate from the downloaded stylist app while sharing brand, data contracts, and service boundaries.

## Product Boundaries

Frizi has two primary products, but this repository implements only the first:

- Client web app: search, matching, professional profiles, booking, reviews, customer hair profile, photo history, and consent management.
- Stylist downloaded app: separate Frizi Pro project.

The salon or studio is location context, not the main owner of reputation. Architecture should keep professional identity, reviews, portfolio media, and customer relationships portable across work locations.

## Suggested Feature Areas

- `src/features/customer-discovery`: search, filters, matching results, and professional profile browsing.
- `src/features/professional-profile`: public professional profile display from stylist-app-owned data.
- `src/features/intake`: landing-to-signup/guest flow, natural-language hair/style description, and collapsed optional filters.
- `src/features/booking`: Calendly-style availability picker, booking confirmation, add-to-calendar prompt, and client-profile appointment visibility.
- `src/features/client-profile`: customer hair profile, shared photos, preferences, and appointment context.
- `src/features/photo-consent`: customer-facing consent decisions for photos and reviews.
- `src/features/reviews`: customer review submission and public professional reputation display.
- `src/features/promotions`: customer-facing offers sent by professionals.
- `src/features/matching`: matching inputs, ranking explanations, and recommendation logic boundaries.
- `src/features/portfolio-viewer`: full-screen work viewer with review overlays and mobile swipe support.

Professional CRM, marketing asset creation, promo authoring, relocation announcements, and chair-side workflow belong in the separate stylist app.

Shared visual components belong under `src/components`. Integration clients and reusable helpers belong under `src/lib`.

## Data Ownership Notes

Customer photos should be private by default. Public or marketing use requires explicit consent.

Customer-entered hair type and style metadata should be modeled separately from professional-entered specialty claims. This separation is central to honest matching.

Reviews should attach to the professional. A salon may have its own page later, but it should not absorb the professional's reputation by default.
