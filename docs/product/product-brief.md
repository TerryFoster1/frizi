# Product Brief

Frizi Client is the public web app for people looking for barbers, hairdressers, and stylists.

The core product belief is that a stylist's reputation should belong to the individual professional, not only to the salon where they currently rent a chair or work. Reviews, client photos, booking demand, and proof of specialization should travel with the professional across salons, studios, and independent work.

## Project Boundary

This repository implements only the client-facing web app.

The stylist app is a separate downloaded Frizi Pro app.

The two products share brand, data contracts, and business rules, but they should be built as separate projects.

## Primary Audiences

- Customers looking for a local hair professional who understands their hair type, desired style, identity, comfort needs, and service preferences.
- Barbers, hairdressers, and stylists who want a portable portfolio, direct booking channel, client CRM, reviews, and marketing tools.
- Salons and studios may appear as location context, but the professional is the primary reputation holder.

## Core Customer Experience

The client web app message is: find a hairstylist who knows your hair and never lose them.

Customers should first describe their hair and style preference in natural language, not by being forced into a rigid taxonomy. This is essential for people whose needs do not fit simple labels like "thin hair", "curly", or "straight".

Example natural-language hair profile:

> I have baby fine thin hair. Not balding, thin. I have had it my whole life and it is hard to work with. It is thinning out in terms of hair per inch now, but still mostly a full head of very thin light hair.

Optional filters should be collapsed behind a filter icon by default. Filters are refinements, not the primary intake method.

Customers search for local professionals using natural-language profile data plus optional filters such as:

- Hair description.
- Desired style or haircut category.
- Texture, length, color, treatment, or maintenance needs.
- Queer-friendly, gender-affirming, culturally competent, accessibility, language, and other comfort/safety filters.
- Practical needs such as being on a public transit route, parking, private room availability, fragrance awareness, or quiet appointment.
- Location, availability, price, and service type.

Frizi matches customers with professionals whose real client outcomes, reviews, and tagged photo history are relevant to the customer's stated hair and style profile. Customers search stylists and barbers, not salons. They can read reviews, inspect client photos, compare professionals, and book directly regardless of which salon or studio the professional currently works from.

Professional profiles should hide long tag lists by default. Specialties and accommodations should be separate sections with their own expand buttons.

Customers should be able to open a professional profile, swipe or browse full-screen client images, and see overlaid review context on the work.

Booking should open a Calendly-style availability picker. After selecting a time, the customer can book and then choose whether to add the appointment to their calendar. The appointment should also appear in the customer's Frizi profile when they log in.

## Companion Stylist App Boundary

Professionals use a separate downloaded app for profile management, bookings, CRM, client photo history, reviews, promotions, relocation notices, and marketing.

Frizi Client must receive approved public profile, availability, review, photo, and consent data from the stylist app. The customer receives appointment photos in their profile. From there, the customer can:

- Keep the photo as a personal hair history reference for future appointments.
- Consent or decline consent for the professional to use the photo for marketing.
- Leave a review attached to the professional.
- Confirm or update hair type and style metadata that helps the matching system.

Once consent exists, the professional can use the approved photo and review in their Frizi portfolio and share it directly to social channels such as Instagram.

Professionals can also send offers directly to clients, such as limited-time discounts, free product with service, bring-a-friend promotions, loyalty coupons, and location-move announcements.

## Reputation Model

Reviews and portfolio proof should stay attached to the professional, not just the salon. A professional changing salons should not lose their reputation, booking credibility, client proof, or discoverability.

Customer-entered hair type and style information is important because it keeps specialization claims honest. A professional should not be able to simply claim they specialize in every hair type or style. The matching system should prefer verified evidence from customer profiles, completed services, consented photos, and reviews.

## Matching Thesis

Frizi should help customers find professionals who have successfully served people with similar hair, style goals, identity needs, and preferences.

The algorithm should use customer-entered metadata, review content, consented portfolio photos, professional service history, and booking context to improve recommendations over time.

The product should avoid flattening identity or hair characteristics into shallow tags. Filters like queer-friendly are trust and comfort signals, not marketing decoration.
