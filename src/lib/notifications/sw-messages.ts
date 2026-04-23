// src/lib/notifications/sw-messages.ts
// Types for messages between app and service worker

export type SWMessageType =
  | 'SKIP_WAITING'
  | 'CHECK_ORDERS'
  | 'NOTIFICATION_CLICK'

export interface SWMessage {
  type:    SWMessageType
  payload?: Record<string, unknown>
}

export function postToSW(message: SWMessage) {
  if (typeof navigator === 'undefined') return
  if (!navigator.serviceWorker?.controller) return
  navigator.serviceWorker.controller.postMessage(message)
}