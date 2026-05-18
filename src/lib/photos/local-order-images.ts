import type { PhotoRecord } from '@/lib/db/schema'

const KEY = 'md_order_images_v1'

function readAll(): PhotoRecord[] {
  if (typeof localStorage === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function writeAll(rows: PhotoRecord[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(rows))
}

export const localOrderImages = {
  list(orderId: string): PhotoRecord[] {
    return readAll().filter(photo => photo.orderId === orderId && photo._deleted !== 1)
  },

  add(photo: PhotoRecord): void {
    writeAll([photo, ...readAll().filter(row => row.id !== photo.id)])
  },

  remove(id: string): void {
    writeAll(readAll().map(row => row.id === id ? { ...row, _deleted: 1 as const } : row))
  },
}
