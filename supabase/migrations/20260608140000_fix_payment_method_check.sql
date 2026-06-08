-- Fix payments_method_check to match app method values
-- App uses: cash, easypaisa, jazzcash, bank, other
-- Old constraint had: cash, card, transfer, online, other

alter table public.payments
  drop constraint if exists payments_method_check;

alter table public.payments
  add constraint payments_method_check
    check (method = any (array['cash'::text, 'easypaisa'::text, 'jazzcash'::text, 'bank'::text, 'other'::text]));

-- Also fix subscription_payments_method_check to allow consistent values
alter table public.subscription_payments
  drop constraint if exists subscription_payments_method_check;

alter table public.subscription_payments
  add constraint subscription_payments_method_check
    check (method = any (array['raast'::text, 'reminder'::text, 'cash'::text, 'bank'::text, 'easypaisa'::text, 'jazzcash'::text, 'other'::text]));
