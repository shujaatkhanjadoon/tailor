import type { TeamMemberRecord } from '@/lib/db/schema'
import type { GarmentType } from '@/types'

export const KARIGAR_SKILLS = [
  'Shalwar Kameez',
  'Kurta/Kurti',
  'Shirt',
  'Trouser/Pajama',
  'Sherwani',
  'Coat',
  'Ladies Formal',
  'Sab Kuch',
] as const

export type KarigarSkill = (typeof KARIGAR_SKILLS)[number]

export const SKILL_TO_GARMENTS: Record<KarigarSkill, GarmentType[]> = {
  'Shalwar Kameez': ['shalwar_kameez'],
  'Kurta/Kurti': ['kurta', 'kurti'],
  Shirt: ['shirt'],
  'Trouser/Pajama': ['trouser', 'pajama'],
  Sherwani: ['sherwani'],
  Coat: ['waistcoat', 'prince_coat', 'pant_coat', 'blazer', 'jacket'],
  'Ladies Formal': ['lehenga', 'maxi', 'kurti'],
  'Sab Kuch': [
    'shalwar_kameez',
    'kurta',
    'kurti',
    'shirt',
    'trouser',
    'pajama',
    'sherwani',
    'waistcoat',
    'prince_coat',
    'pant_coat',
    'lehenga',
    'maxi',
    'blazer',
    'jacket',
    'other',
  ],
}

export function parseKarigarSkills(speciality?: string): KarigarSkill[] {
  const skills = (speciality ?? 'Sab Kuch')
    .split(',')
    .map(s => s.trim())
    .filter((s): s is KarigarSkill => KARIGAR_SKILLS.includes(s as KarigarSkill))

  return skills.length > 0 ? skills : ['Sab Kuch']
}

export function formatKarigarSkills(skills: string[]): string {
  const clean = skills
    .map(s => s.trim())
    .filter((s): s is KarigarSkill => KARIGAR_SKILLS.includes(s as KarigarSkill))

  if (clean.includes('Sab Kuch') || clean.length === 0) return 'Sab Kuch'
  return Array.from(new Set(clean)).join(', ')
}

export function canKarigarHandleGarment(member: TeamMemberRecord, garmentType?: string) {
  if (!garmentType) return true
  const allowed = parseKarigarSkills(member.speciality).flatMap(skill => SKILL_TO_GARMENTS[skill] ?? [])
  return allowed.length === 0 || allowed.includes(garmentType as GarmentType)
}
