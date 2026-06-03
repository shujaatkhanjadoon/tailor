// src/lib/supabase/types.ts
// These mirror the Dexie schema so sync is straightforward

export interface Database {
  public: {
    Tables: {
      shops: {
        Row:    ShopRow
        Insert: ShopRow
        Update: Partial<ShopRow>
      }
      team_members: {
        Row:    TeamMemberRow
        Insert: TeamMemberRow
        Update: Partial<TeamMemberRow>
      }
      customers: {
        Row:    CustomerRow
        Insert: CustomerRow
        Update: Partial<CustomerRow>
      }
      measurements: {
        Row:    MeasurementRow
        Insert: MeasurementRow
        Update: Partial<MeasurementRow>
      }
      orders: {
        Row:    OrderRow
        Insert: OrderRow
        Update: Partial<OrderRow>
      }
      payments: {
        Row:    PaymentRow
        Insert: PaymentRow
        Update: Partial<PaymentRow>
      }
      order_photos: {
        Row:    PhotoRow
        Insert: PhotoRow
        Update: Partial<PhotoRow>
      }
      order_status_history: {
        Row:    StatusHistoryRow
        Insert: StatusHistoryRow
        Update: Partial<StatusHistoryRow>
      }
    }
  }
}

export interface ShopRow {
  id:               string
  owner_phone:      string
  owner_name?:      string
  shop_name:        string
  whatsapp_number?: string
  state_province?:  string
  city?:            string
  address_line?:    string
  postal_code?:     string
  brand_name?:      string
  brand_color?:     string
  brand_logo_url?:  string
  plan:             'starter' | 'professional' | 'business'
  plan_expires_at?: string
  is_active:        boolean
  created_at:       string
  updated_at:       string
}

export interface TeamMemberRow {
  id:           string
  shop_id:      string
  name:         string
  phone:        string
  role:         'owner' | 'karigar'
  pin_hash:     string      // bcrypt hash in production
  speciality?:  string
  pay_rate_type?: 'daily' | 'per_order' | 'monthly'
  pay_rate?:    number
  is_active:    boolean
  joined_at:    string
  created_at:   string
  deleted_at?:  string
}

export interface CustomerRow {
  id:           string
  shop_id:      string
  name:         string
  phone:        string
  whatsapp?:    string
  gender:       'male' | 'female' | 'child'
  notes?:       string
  photo_url?:   string
  total_orders: number
  created_at:   string
  updated_at:   string
  last_order_at?: string
  deleted_at?:  string
}

export interface MeasurementRow {
  id:           string
  customer_id:  string
  shop_id:      string
  order_for_relation?: string
  order_for_name?: string
  recipient_gender?: 'male' | 'female' | 'child'
  garment_type: string
  values:       Record<string, string>
  notes?:       string
  taken_at:     string
  deleted_at?:  string
}

export interface OrderRow {
  id:                   string
  shop_id:              string
  order_number:         number
  tracking_code?:       string
  customer_id:          string
  customer_name:        string
  customer_phone:       string
  order_for_relation?:  string
  order_for_name?:      string
  recipient_gender?:    'male' | 'female' | 'child'
  measurement_id?:      string
  garment_type:         string
  status:               string
  assigned_to?:         string
  assigned_to_name?:    string
  total_price:          number
  amount_paid:          number
  is_urgent:            boolean
  due_date:             string
  special_instructions?: string
  fabric_photo_url?:    string
  style_photo_url?:     string
  created_at:           string
  updated_at:           string
  delivered_at?:        string
  deleted_at?:          string
}

export interface PaymentRow {
  id:           string
  shop_id:      string
  order_id:     string
  amount:       number
  applied_to_balance?: number
  kind?:        'order_payment' | 'tip' | 'overpayment'
  method:       string
  recorded_by:  string
  paid_at:      string
  notes?:       string
  deleted_at?:  string
}

export interface PhotoRow {
  id:            string
  order_id:      string
  shop_id:       string
  type:          'fabric' | 'style' | 'reference'
  cloud_url?:    string
  public_id?:    string
  cloud_size_kb?: number
  size_kb:       number
  taken_at:      string
  deleted_at?:   string
}

export interface StatusHistoryRow {
  id:          string
  order_id:    string
  old_status:  string
  new_status:  string
  changed_by:  string
  changed_at:  string
}
