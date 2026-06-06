// src/lib/supabase/types.ts
// These mirror the Dexie schema so sync is straightforward

export interface Database {
  public: {
    Tables: {
      shops:                     { Row: ShopRow;                     Insert: Partial<ShopRow>;    Update: Partial<ShopRow>; Relationships: [] }
      team_members:              { Row: TeamMemberRow;              Insert: Partial<TeamMemberRow>;    Update: Partial<TeamMemberRow>; Relationships: [] }
      customers:                 { Row: CustomerRow;                 Insert: Partial<CustomerRow>;    Update: Partial<CustomerRow>; Relationships: [] }
      measurements:              { Row: MeasurementRow;              Insert: Partial<MeasurementRow>;    Update: Partial<MeasurementRow>; Relationships: [] }
      orders:                    { Row: OrderRow;                    Insert: Partial<OrderRow>;    Update: Partial<OrderRow>; Relationships: [] }
      payments:                  { Row: PaymentRow;                  Insert: Partial<PaymentRow>;    Update: Partial<PaymentRow>; Relationships: [] }
      order_photos:              { Row: PhotoRow;                    Insert: Partial<PhotoRow>;    Update: Partial<PhotoRow>; Relationships: [] }
      order_status_history:      { Row: StatusHistoryRow;            Insert: Partial<StatusHistoryRow>;    Update: Partial<StatusHistoryRow>; Relationships: [] }
      subscriptions:             { Row: SubscriptionRow;             Insert: Partial<SubscriptionRow>;    Update: Partial<SubscriptionRow>; Relationships: [] }
      subscription_payments:     { Row: SubscriptionPaymentRow;      Insert: Partial<SubscriptionPaymentRow>;    Update: Partial<SubscriptionPaymentRow>; Relationships: [] }
      shop_usage:                { Row: ShopUsageRow;                Insert: Partial<ShopUsageRow>;    Update: Partial<ShopUsageRow>; Relationships: [] }
      admin_audit_log:           { Row: AdminAuditLogRow;            Insert: Partial<AdminAuditLogRow>;    Update: Partial<AdminAuditLogRow>; Relationships: [] }
      admin_notifications:       { Row: AdminNotificationRow;        Insert: Partial<AdminNotificationRow>;    Update: Partial<AdminNotificationRow>; Relationships: [] }
      shop_verification_requests: { Row: ShopVerificationRequestRow;  Insert: Partial<ShopVerificationRequestRow>;  Update: Partial<ShopVerificationRequestRow>; Relationships: [] }
      email_verifications:       { Row: EmailVerificationRow;        Insert: Partial<EmailVerificationRow>;    Update: Partial<EmailVerificationRow>; Relationships: [] }
      push_subscriptions:        { Row: PushSubscriptionRow;         Insert: Partial<PushSubscriptionRow>;    Update: Partial<PushSubscriptionRow>; Relationships: [] }
    }
    Views: Record<string, unknown>
    Functions: Record<string, unknown>
    Enums: Record<string, unknown>
    CompositeTypes: Record<string, unknown>
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
