# Requested Changes Log

## Completed in code

- Enforced Professional karigar cap at 3 active karigars in the team UI.
- Added karigar edit support for name, phone, PIN, speciality, and Business salary settings.
- Confirmed Starter limits in plan source of truth: 30 orders/month and 50 customers total.
- Hid new-order tracking link and WhatsApp tracking share for Starter users; Starter sees an upgrade message instead.
- Restricted the order QR modal/button to Professional and Business users.
- Made NAP required when creating an order: user must choose a previous same-category NAP or enter a new one.
- Added previous same-category NAP reuse in the order wizard.
- Added customer NAP edit support and category filtering on the customer measurement page.
- Added payment surplus tracking as tip vs overpayment, with only balance-applied amount counted toward order balance.
- Added Business Cloudinary photo metadata sync so uploaded Cloudinary images can appear on other devices after sync.
- Fixed Cloudinary delete to call the server delete route whenever a `publicId` exists.
- Added Business custom branding fields in shop settings.
- Added Business karigar salary report support through pay rate settings and report totals.
- Added admin dashboard expiry warnings for paid subscriptions at 5, 3, and 1 day, with a ready WhatsApp reminder link.
- Updated subscription expiry cron to move expired paid/trial subscriptions back to active Starter access.
- Made PIN change refresh the active session after saving.

## Supabase changes required

- Run `SUPABASE_CHANGES.sql` in the Supabase SQL Editor.
- Add these environment variables for Cloudinary deletion if missing:
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
  - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`

## Guidance / not fully automatable for free

- WhatsApp “auto-notifications” cannot be sent directly for free through normal WhatsApp without user action. The implemented free path queues/generates WhatsApp click-to-chat links for admin/manual sending. True automatic delivery requires WhatsApp Cloud API, a verified Meta app/number, and usually paid conversation charges after the free tier.
- Phone-owner verification cannot be made strong for free without an SMS/WhatsApp OTP provider. Best free approach is a manual admin verification flow: owner signs up, admin confirms by WhatsApp/phone call, then activates the shop. A future hardening step should add a `verification_status` column and block full access until verified.
