# Hairline Stylist App Build Handoff

The complete build handoff for the separate stylist/barber app has been mirrored into the stylist project at:

`C:\Users\kathr\Documents\Claude CoWork Files\Projects\Apps\Hairline stylist\CLIENT_APP_HANDOFF.md`

This client repo remains the public web app at:

`C:\Users\kathr\Documents\Claude CoWork Files\Projects\Apps\Hairline`

## Summary For Client-Side Coordination

Hairline Stylist must be a separate downloaded mobile-first app for professionals. It must provide the profile, availability, CRM, photo, consent, review, promotion, and relocation data that powers Hairline Client.

Hairline Client expects public professional records with:

- Profile identity.
- Current work location.
- Transit/accessibility notes.
- Services and price range.
- Availability and booking entry point.
- Specialties.
- Accommodations.
- Approved portfolio photos.
- Approved reviews.
- Demo video slot.
- Current promotions.
- Consent state for public/marketing assets.

Hairline Client sends or creates:

- Booking requests.
- Natural-language client hair descriptions.
- Style preferences.
- Accommodation needs.
- Shared client photos.
- Consent decisions.
- Reviews.

Key shared events:

- `booking_requested`
- `booking_confirmed`
- `client_profile_shared`
- `appointment_completed`
- `photo_sent_to_client`
- `marketing_consent_requested`
- `marketing_consent_granted`
- `marketing_consent_revoked`
- `review_submitted`
- `review_approved_public`
- `promotion_sent`
- `professional_location_changed`
- `relocation_notice_sent`

See the stylist project handoff file for the full build brief, screen list, data shapes, and implementation phases.
