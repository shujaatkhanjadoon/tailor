# Maintenance Log

## Completed

- Added subscription billing cycle and renewal/expiry date visibility on `/admin/dashboard/shops`.
- Added super admin shop activation/deactivation actions and audit logging support.
- Reworked payment submission so the generated payment reference is read-only and users enter only payer name plus transaction ID.
- Replaced the invalid banking deep-link QR with a plain payment-details QR and clarified that Raast payments should use the Raast ID manually.
- Improved `/admin/dashboard/logs` layout for mobile screens.
- Added a mobile bottom navigation for the admin dashboard.
- Replaced the Starter-plan blurred photo area with an upgrade prompt/modal.
- Added an upgrade modal when Starter users attempt karigar assignment.
- Kept Professional photos local-only and Business photos cloud-enabled through the existing photo upload hook.
- Reduced duplicate setup/login redirect paths that could cause flickering.
- Updated DarziHub branding and footer copyright text.

## Pending

- Apply the optional Supabase SQL checks listed in the assistant handoff if existing databases do not have `shops.is_active`.
- Test Raast QR behavior with your target banking apps; official bank-generated EMV QR support may require bank/provider-issued payloads.
- Run device-level responsive QA across the remaining long-tail pages before production release.
