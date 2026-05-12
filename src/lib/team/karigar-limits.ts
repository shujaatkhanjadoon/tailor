import type { TeamMemberRecord } from '@/lib/db/schema'

export function getSelectableKarigarIds(
  members: TeamMemberRecord[],
  limit: number,
): Set<string> {
  const karigars = members
    .filter(m => m.role === 'karigar' && m.isActive === 1 && m._deleted === 0)
    .sort((a, b) => {
      const joined = a.joinedAt.localeCompare(b.joinedAt)
      if (joined !== 0) return joined
      return a.createdAt.localeCompare(b.createdAt)
    })

  if (limit >= 999) return new Set(karigars.map(m => m.id))
  if (limit <= 0) return new Set()
  return new Set(karigars.slice(0, limit).map(m => m.id))
}

export function getKarigarLimitMessage(limit: number): string {
  if (limit <= 0) return 'Starter plan mein karigar assignment available nahi hai.'
  if (limit >= 999) return 'Business plan mein unlimited karigar assignment available hai.'
  return `Professional plan mein pehle ${limit} karigar assign ho sakte hain.`
}
