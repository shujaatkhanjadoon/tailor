// src/lib/supabase/sync-service.ts
// App records are read/written directly through Supabase operations.

export const syncService = {
  isOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine
  },

  async pushAll(_shopId: string): Promise<{ success: boolean; errors: string[] }> {
    return { success: true, errors: [] }
  },

  async pullAll(_shopId: string): Promise<void> {
    // No IndexedDB app-data mirror to hydrate.
  },

  async getOrderByTrackingCode(_code: string): Promise<null> {
    return null
  },

  async getOrderByNumber(_orderNumber: number): Promise<null> {
    return null
  },

  startAutoSync(_shopId: string): () => void {
    return () => {}
  },
}
