import { normaliseCode, isValidTrackingCode } from '@/lib/tracking'
import { createServerClient } from '@/lib/supabase/server'
import { mapOrder } from '@/lib/supabase/records'
import TrackClient from '@/components/track/TrackClient'

type TrackShop = {
  shop_name?: string | null
  brand_name?: string | null
  brand_color?: string | null
  brand_logo_url?: string | null
}
type TrackOrderRow = Record<string, unknown> & {
  shops?: TrackShop | null
}

const TRACK_ORDER_COLUMNS = 'id,shop_id,order_number,tracking_code,customer_id,customer_name,customer_phone,order_for_relation,order_for_name,recipient_gender,measurement_id,garment_type,status,assigned_to,assigned_to_name,total_price,amount_paid,is_urgent,due_date,special_instructions,fabric_photo_url,style_photo_url,created_at,updated_at,delivered_at,deleted_at,shops(shop_name,brand_name,brand_color,brand_logo_url)'

export default async function TrackPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const normCode = normaliseCode(code)
  let initialOrder = null
  let initialShopName = ''
  let initialBranding = {
    name: '',
    color: '#1d4ed8',
    logoUrl: '',
  }

  if (isValidTrackingCode(normCode)) {
    try {
      const supabase = createServerClient()
      const query = supabase
        .from('orders')
        .select(TRACK_ORDER_COLUMNS)
        .eq('tracking_code', normCode)
        .is('deleted_at', null)
        .maybeSingle() as unknown as Promise<{ data: TrackOrderRow | null; error: unknown }>

      const { data: remote } = await query

      if (remote) {
        initialOrder = mapOrder(remote)
        const shop = remote.shops as TrackShop | null | undefined
        initialShopName = shop?.brand_name ?? shop?.shop_name ?? ''
        initialBranding = {
          name: shop?.brand_name ?? shop?.shop_name ?? 'MeraDarzi',
          color: shop?.brand_color ?? '#1d4ed8',
          logoUrl: shop?.brand_logo_url ?? '',
        }
      }
    } catch (e) {
      console.error('Track SSR error:', e)
    }
  }

  return (
    <TrackClient
      initialOrder={initialOrder}
      initialShopName={initialShopName}
      initialBranding={initialBranding}
      normCode={normCode}
    />
  )
}
