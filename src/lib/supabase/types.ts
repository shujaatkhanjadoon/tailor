// src/lib/supabase/types.ts
// These mirror the Dexie schema so sync is straightforward

export interface Database {
  public: {
    Tables: {
      shops:                     { Row: ShopRow;                     Insert: ShopRow;                     Update: Partial<ShopRow> }
      team_members:              { Row: TeamMemberRow;              Insert: TeamMemberRow;              Update: Partial<TeamMemberRow> }
      customers:                 { Row: CustomerRow;                 Insert: CustomerRow;                 Update: Partial<CustomerRow> }
      measurements:              { Row: MeasurementRow;              Insert: MeasurementRow;              Update: Partial<MeasurementRow> }
      orders:                    { Row: OrderRow;                    Insert: OrderRow;                    Update: Partial<OrderRow> }
      payments:                  { Row: PaymentRow;                  Insert: PaymentRow;                  Update: Partial<PaymentRow> }
      order_photos:              { Row: PhotoRow;                    Insert: PhotoRow;                    Update: Partial<PhotoRow> }
      order_status_history:      { Row: StatusHistoryRow;            Insert: StatusHistoryRow;            Update: Partial<StatusHistoryRow> }
      subscriptions:             { Row: SubscriptionRow;             Insert: SubscriptionRow;             Update: Partial<SubscriptionRow> }
      subscription_payments:     { Row: SubscriptionPaymentRow;      Insert: SubscriptionPaymentRow;      Update: Partial<SubscriptionPaymentRow> }
      shop_usage:                { Row: ShopUsageRow;                Insert: ShopUsageRow;                Update: Partial<ShopUsageRow> }
      admin_audit_log:           { Row: AdminAuditLogRow;            Insert: AdminAuditLogRow;            Update: Partial<AdminAuditLogRow> }
      admin_notifications:       { Row: AdminNotificationRow;        Insert: AdminNotificationRow;        Update: Partial<AdminNotificationRow> }
      shop_verification_requests: { Row: ShopVerificationRequestRow;  Insert: ShopVerificationRequestRow;  Update: Partial<ShopVerificationRequestRow> }
      email_verifications:       { Row: EmailVerificationRow;        Insert: EmailVerificationRow;        Update: Partial<EmailVerificationRow> }
      push_subscriptions:        { Row: PushSubscriptionRow;         Insert: PushSubscriptionRow;         Update: Partial<PushSubscriptionRow> }
    }
  }
}

// ── Core business tables ──────────────────────────────────────────

export interface ShopRow {
  id:                  string
  owner_phone:         string
  owner_name?:         string
  owner_email?:        string
  shop_name:           string
  whatsapp_number?:    string
  state_province?:     string
  city?:               string
  address_line?:       string
  postal_code?:        string
  brand_name?:         string
  brand_color?:        string
  brand_logo_url?:     string
  plan:                'starter' | 'professional' | 'business'
  plan_expires_at?:    string
  is_active:           boolean
  verification_status?: string
  encrypted_owner_pin?: string
  created_at:          string
  updated_at:          string
}

export interface TeamMemberRow {
  id:               string
  shop_id:          string
  name:             string
  phone:            string
  role:             'owner' | 'karigar'
  pin_hash:         string      // bcrypt hash in production
  email?:           string
  email_verified?:  boolean
  speciality?:      string
  pay_rate_type?:   'daily' | 'per_order' | 'monthly'
  pay_rate?:        number
  is_active:        boolean
  failed_attempts?: number
  joined_at:        string
  created_at:       string
  deleted_at?:      string
}

export interface CustomerRow {
  id:              string
  shop_id:         string
  name:            string
  phone:           string
  whatsapp?:       string
  gender:          'male' | 'female' | 'child'
  notes?:          string
  photo_url?:      string
  total_orders:    number
  created_at:      string
  updated_at:      string
  last_order_at?:  string
  deleted_at?:     string
}

export interface MeasurementRow {
  id:                  string
  customer_id:         string
  shop_id:             string
  order_for_relation?: string
  order_for_name?:     string
  recipient_gender?:   'male' | 'female' | 'child'
  garment_type:        string
  values:              Record<string, string>
  notes?:              string
  taken_at:            string
  deleted_at?:         string
}

export interface OrderRow {
  id:                     string
  shop_id:                string
  order_number:           number
  tracking_code?:         string
  customer_id:            string
  customer_name:          string
  customer_phone:         string
  order_for_relation?:    string
  order_for_name?:        string
  recipient_gender?:      'male' | 'female' | 'child'
  measurement_id?:        string
  garment_type:           string
  status:                 string
  assigned_to?:           string
  assigned_to_name?:      string
  total_price:            number
  amount_paid:            number
  is_urgent:              boolean
  due_date:               string
  special_instructions?:  string
  fabric_photo_url?:      string
  style_photo_url?:       string
  created_at:             string
  updated_at:             string
  delivered_at?:          string
  deleted_at?:            string
}

export interface PaymentRow {
  id:                string
  shop_id:           string
  order_id:          string
  amount:            number
  applied_to_balance?: number
  kind?:             'order_payment' | 'tip' | 'overpayment'
  method:            string
  recorded_by:       string
  paid_at:           string
  notes?:            string
  deleted_at?:       string
}

export interface PhotoRow {
  id:             string
  order_id:       string
  shop_id:        string
  type:           'fabric' | 'style' | 'reference'
  cloud_url?:     string
  public_id?:     string
  cloud_size_kb?: number
  size_kb:        number
  taken_at:       string
  deleted_at?:    string
}

export interface StatusHistoryRow {
  id:         string
  order_id:   string
  shop_id:    string
  old_status: string
  new_status: string
  changed_by: string
  changed_at: string
}

// ── Billing / Subscription tables ─────────────────────────────────

export interface SubscriptionRow {
  id:               string
  shop_id:          string
  plan:             'starter' | 'professional' | 'business'
  status:           'trialing' | 'active' | 'cancelled' | 'expired' | 'grace'
  billing_cycle?:   'monthly' | 'yearly' | 'lifetime'
  trial_ends_at?:   string
  expires_at?:      string
  grace_ends_at?:   string
  cancelled_at?:    string
  amount_pkr?:      number
  gateway?:         string
  gateway_sub_id?:  string
  created_at?:      string
  updated_at:       string
}

export interface SubscriptionPaymentRow {
  id:               string
  shop_id:          string
  subscription_id?: string
  plan:             string
  billing_cycle:    string
  amount_pkr:       number
  method:           string
  gateway_tx_id?:   string
  status:           'pending' | 'completed' | 'failed' | 'refunded'
  paid_at:          string
  receipt_data?:    Record<string, any>
  created_at?:      string
}

export interface ShopUsageRow {
  id:                string
  shop_id:           string
  orders_this_month: number
  customers_total:   number
  karigar_count:     number
  storage_used_kb:   number
  month_year?:       string
  updated_at:        string
}

// ── Admin tables ──────────────────────────────────────────────────

export interface AdminAuditLogRow {
  id:           string
  action:       string
  target_type:  string
  target_id:    string
  shop_id?:     string
  details?:     Record<string, any>
  performed_at: string
}

export interface AdminNotificationRow {
  id:          string
  title:       string
  message:     string
  type:        'info' | 'success' | 'warning' | 'urgent'
  target_plan: 'all' | 'starter' | 'professional' | 'business'
  expires_at:  string
  created_at?: string
}

export interface ShopVerificationRequestRow {
  id:             string
  shop_id:        string
  owner_name:     string
  owner_phone:    string
  owner_email?:   string
  city?:          string
  state_province?: string
  status:         'pending' | 'verified' | 'rejected'
  requested_at:   string
}

// ── Auth / misc tables ────────────────────────────────────────────

export interface EmailVerificationRow {
  id:          string
  phone:       string
  email:       string
  otp_hash:    string
  attempts:    number
  expires_at:  string
  verified_at?: string
  created_at?: string
}

export interface PushSubscriptionRow {
  id:           string
  shop_id:      string
  member_id?:   string
  endpoint:     string
  p256dh:       string
  auth:         string
  user_agent?:  string
  last_seen_at?: string
  created_at?:  string
}
