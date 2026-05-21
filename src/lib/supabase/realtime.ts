// src/lib/supabase/realtime.ts
// Hooks subscribe to Supabase directly. This legacy helper remains for callers.

export interface RealtimeSubscription {
  unsubscribe: () => void
}

export function subscribeToShop(
  _shopId: string,
  _onChange: () => void,
): RealtimeSubscription {
  return {
    unsubscribe: () => {},
  }
}
