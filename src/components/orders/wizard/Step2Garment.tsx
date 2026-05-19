// src/components/orders/wizard/Step2Garment.tsx
'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, UsersRound } from 'lucide-react'
import { GarmentType, GARMENT_LABELS, OrderRecipientRelation } from '@/types'
import { cn } from '@/lib/utils'
import { Camera } from 'lucide-react'
import { compressImage } from '@/lib/photos/compress'
import type { MeasurementRecord } from '@/lib/db/schema'
import { ToggleSwitch } from '@/components/ui/toggle-switch'
import { supabase } from '@/lib/supabase/client'
import { mapMeasurement } from '@/lib/supabase/records'
import { isParentRelation, napOwnerLabel, recipientLabel, relationNeedsName } from '@/lib/order-recipient'

// Measurement fields per garment type
const FABRIC_HINTS: Record<GarmentType, string> = {
  shalwar_kameez: 'Lawn, cotton, wash & wear, boski, khaddar, linen',
  kurta: 'Cotton, wash & wear, linen, khaddar, boski',
  kurti: 'Lawn, cotton, cambric, chiffon, silk',
  shirt: 'Cotton, lawn, poplin, cambric, silk, chiffon',
  trouser: 'Cotton, denim, twill, linen, suiting',
  pajama: 'Cotton, wash & wear, lawn, linen',
  sherwani: 'Jamawar, banarsi, raw silk, velvet, brocade',
  waistcoat: 'Suiting, jamawar, raw silk, wash & wear',
  prince_coat: 'Suiting, jamawar, velvet, raw silk',
  pant_coat: 'Suiting, tropical, wool blend, wash & wear',
  lehenga: 'Net, chiffon, organza, raw silk, banarsi',
  maxi: 'Chiffon, net, silk, georgette, organza',
  blazer: 'Suiting, wool blend, tweed, tropical',
  jacket: 'Denim, cotton, suiting, leatherette',
  other: 'Abaya, kids wear, custom design',
}

const MEASUREMENT_FIELDS: Record<GarmentType, { key: string; label: string; unit: string }[]> = {
  shalwar_kameez: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'hip', label: 'Hip (Kolha)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
    { key: 'armhole', label: 'Armhole (Baazu Golai)', unit: 'inch' },
    { key: 'bicep', label: 'Bicep (Bazoo)', unit: 'inch' },
    { key: 'collar', label: 'Collar (Gireban)', unit: 'inch' },
    { key: 'front_neck', label: 'Front Neck (Agla Gala)', unit: 'inch' },
    { key: 'back_neck', label: 'Back Neck (Pichla Gala)', unit: 'inch' },
    { key: 'trouser_length', label: 'Shalwar Length (Shalwar Lambai)', unit: 'inch' },
    { key: 'trouser_waist', label: 'Shalwar Waist (Nara)', unit: 'inch' },
    { key: 'thigh', label: 'Thigh (Raan)', unit: 'inch' },
    { key: 'knee', label: 'Knee (Ghutna)', unit: 'inch' },
    { key: 'bottom', label: 'Bottom (Paincha)', unit: 'inch' },
  ],
  kurta: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
    { key: 'collar', label: 'Collar/Gala', unit: 'inch' },
    { key: 'bottom', label: 'Daman Width', unit: 'inch' },
  ],
  kurti: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'hip', label: 'Hip (Kolha)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
  ],
  shirt: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
    { key: 'collar', label: 'Collar (Gireban)', unit: 'inch' },
    { key: 'cuff', label: 'Cuff (Kaf)', unit: 'inch' },
  ],
  trouser: [
    { key: 'trouser_length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'trouser_waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'hip', label: 'Hip (Sirin)', unit: 'inch' },
    { key: 'thigh', label: 'Thigh (Raan)', unit: 'inch' },
    { key: 'knee', label: 'Knee (Ghutna)', unit: 'inch' },
    { key: 'bottom', label: 'Bottom (Paincha)', unit: 'inch' },
  ],
  pajama: [
    { key: 'trouser_length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'trouser_waist', label: 'Waist/Nara', unit: 'inch' },
    { key: 'hip', label: 'Hip (Sirin)', unit: 'inch' },
    { key: 'thigh', label: 'Thigh (Raan)', unit: 'inch' },
    { key: 'bottom', label: 'Paincha', unit: 'inch' },
  ],
  sherwani: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
    { key: 'hip', label: 'Hip (Kolha)', unit: 'inch' },
  ],
  waistcoat: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
  ],
  prince_coat: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'hip', label: 'Hip (Kolha)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
  ],
  pant_coat: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
    { key: 'trouser_length', label: 'Pant Length', unit: 'inch' },
    { key: 'trouser_waist', label: 'Pant Waist', unit: 'inch' },
  ],
  lehenga: [
    { key: 'length', label: 'Lehenga Length', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'hip', label: 'Hip (Kolha)', unit: 'inch' },
    { key: 'chest', label: 'Blouse Chest', unit: 'inch' },
    { key: 'shoulder', label: 'Blouse Shoulder', unit: 'inch' },
    { key: 'sleeve', label: 'Blouse Sleeve', unit: 'inch' },
  ],
  maxi: [
    { key: 'length', label: 'Full Length', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'hip', label: 'Hip (Kolha)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
  ],
  blazer: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
  ],
  jacket: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
  ],
  other: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
  ],
}

const RECIPIENT_OPTIONS: {
  relation: OrderRecipientRelation
  label: string
  helper: string
  gender: 'male' | 'female' | 'child' | 'same' | 'custom'
}[] = [
  { relation: 'self', label: 'Self', helper: 'Gahak ke liye', gender: 'same' },
  { relation: 'wife', label: 'Wife', helper: 'Biwi ke liye', gender: 'female' },
  { relation: 'husband', label: 'Husband', helper: 'Shohar ke liye', gender: 'male' },
  { relation: 'son', label: 'Son', helper: 'Beta ke liye', gender: 'child' },
  { relation: 'daughter', label: 'Daughter', helper: 'Beti ke liye', gender: 'child' },
  { relation: 'brother', label: 'Brother', helper: 'Bhai ke liye', gender: 'male' },
  { relation: 'sister', label: 'Sister', helper: 'Behen ke liye', gender: 'female' },
  { relation: 'father', label: 'Father', helper: 'Abu ke liye', gender: 'male' },
  { relation: 'mother', label: 'Mother', helper: 'Ammi ke liye', gender: 'female' },
  { relation: 'other', label: 'Other', helper: 'Kisi aur ke liye', gender: 'custom' },
]

const RECIPIENTS_BY_CUSTOMER: Record<'male' | 'female' | 'child', OrderRecipientRelation[]> = {
  male: ['self', 'wife', 'son', 'daughter', 'brother', 'sister', 'father', 'mother', 'other'],
  female: ['self', 'husband', 'son', 'daughter', 'brother', 'sister', 'father', 'mother', 'other'],
  child: ['self', 'brother', 'sister', 'father', 'mother', 'other'],
}

const GARMENTS_BY_RECIPIENT: Record<'male' | 'female' | 'child', GarmentType[]> = {
  male: [
    'shalwar_kameez',
    'kurta',
    'shirt',
    'trouser',
    'pajama',
    'waistcoat',
    'prince_coat',
    'pant_coat',
    'sherwani',
    'blazer',
    'jacket',
    'other',
  ],
  female: [
    'shalwar_kameez',
    'kurti',
    'shirt',
    'trouser',
    'pajama',
    'lehenga',
    'maxi',
    'jacket',
    'other',
  ],
  child: [
    'shalwar_kameez',
    'kurta',
    'kurti',
    'shirt',
    'trouser',
    'pajama',
    'waistcoat',
    'jacket',
    'other',
  ],
}

function relationLabel(relation?: OrderRecipientRelation) {
  return RECIPIENT_OPTIONS.find(option => option.relation === relation)?.label ?? 'Self'
}

function inferRecipientGender(
  relation: OrderRecipientRelation | undefined,
  customerGender?: 'male' | 'female' | 'child',
  selected?: 'male' | 'female' | 'child',
): 'male' | 'female' | 'child' {
  if (relation === 'self') return customerGender ?? 'male'
  if (relation === 'wife' || relation === 'sister' || relation === 'mother') return 'female'
  if (relation === 'husband' || relation === 'brother' || relation === 'father') return 'male'
  if (relation === 'son' || relation === 'daughter') return 'child'
  return selected ?? customerGender ?? 'male'
}

function normalizeRecipientName(value?: string) {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? ''
}

type KnownRecipient = {
  name: string
  gender?: 'male' | 'female' | 'child'
  lastUsedAt: string
}

function measurementMatchesRecipient(
  measurement: MeasurementRecord,
  relation: OrderRecipientRelation,
  name: string | undefined,
  gender: 'male' | 'female' | 'child',
) {
  const measurementRelation = measurement.orderForRelation ?? 'self'
  const selectedName = normalizeRecipientName(name)
  const measurementName = normalizeRecipientName(measurement.orderForName)
  const measurementGender = measurement.recipientGender

  if (selectedName) {
    return selectedName === measurementName
  }

  if (measurementRelation === relation) return true

  if (gender === 'child' && (relation === 'son' || relation === 'daughter')) {
    return (
      measurementGender === 'child' ||
      measurementRelation === 'son' ||
      measurementRelation === 'daughter' ||
      measurementRelation === 'self'
    )
  }

  if (relation === 'other' && gender === 'child') {
    return measurementGender === 'child'
  }

  if (isParentRelation(relation) && measurementRelation === 'other' && !measurementName) {
    return measurementGender === gender
  }

  return false
}

export type StyleSelections = {
  neck?: string
  daman?: string
  sleeve?: string
  fit?: string
  bottom?: string
  pocket?: string
  length?: string
  collar?: string
  cuff?: string
  button?: string
  buttons?: string[]
  extras?: string[]
}

type StyleKey = keyof StyleSelections
type StyleGroup = {
  key: StyleKey
  title: string
  helper: string
  type: 'radio' | 'checkbox'
  options: { label: string; icon: string; hint?: string }[]
}

const STYLE_GROUPS: StyleGroup[] = [
  {
    key: 'neck',
    title: 'Neck / Gala Style',
    helper: 'Gala ki shape select karein',
    type: 'radio',
    options: [
      { label: 'Round Neck (Gol Gala)', icon: '○' },
      { label: 'Ban Collar (Ban Gala)', icon: '▯' },
      { label: 'V Neck (V Gala)', icon: 'V' },
      { label: 'Collar Neck (Collar Gala)', icon: '⌑' },
      { label: 'Sherwani Collar (Sherwani Gala)', icon: '▰' },
      { label: 'Chinese Collar (Cheeni Gala)', icon: '▱' },
    ],
  },
  {
    key: 'daman',
    title: 'Daman Style',
    helper: 'Kameez/kurta ka neeche wala cut',
    type: 'radio',
    options: [
      { label: 'Round Daman (Gol Daman)', icon: '◠' },
      { label: 'Square Daman (Chokor Daman)', icon: '□' },
      { label: 'Round Cut Daman (Gol Cut Daman)', icon: '⌒' },
      { label: 'Side Cut Daman (Side Chak)', icon: '⇲' },
      { label: 'Straight Daman (Seedha Daman)', icon: '▬' },
    ],
  },
  {
    key: 'sleeve',
    title: 'Sleeve Style',
    helper: 'Aasteen ka style',
    type: 'radio',
    options: [
      { label: 'Full Sleeve (Puri Aasteen)', icon: '┃' },
      { label: 'Half Sleeve (Aadhi Aasteen)', icon: '╻' },
      { label: 'Cuff Sleeve (Kaf Aasteen)', icon: '▣' },
      { label: 'Loose Sleeve (Khuli Aasteen)', icon: '◫' },
      { label: 'Straight Sleeve (Seedhi Aasteen)', icon: '▌' },
    ],
  },
  {
    key: 'fit',
    title: 'Fit Type',
    helper: 'Kapray ki fitting',
    type: 'radio',
    options: [
      { label: 'Slim Fit (Chipka Fit)', icon: 'S' },
      { label: 'Regular Fit (Normal Fit)', icon: 'R' },
      { label: 'Loose Fit (Khula Fit)', icon: 'L' },
    ],
  },
  {
    key: 'bottom',
    title: 'Bottom Style',
    helper: 'Paincha / bottom ka cut',
    type: 'radio',
    options: [
      { label: 'Straight Bottom (Seedha Paincha)', icon: '║' },
      { label: 'Narrow Bottom (Tang Paincha)', icon: '⌯' },
      { label: 'Wide Bottom (Khula Paincha)', icon: '⌵' },
      { label: 'Cuffed Bottom (Mori Wala Paincha)', icon: '▤' },
    ],
  },
  {
    key: 'pocket',
    title: 'Pocket Style',
    helper: 'Jaib ka style',
    type: 'radio',
    options: [
      { label: 'Side Pocket (Side Jaib)', icon: '◧' },
      { label: 'Front Pocket (Samne Jaib)', icon: '▣' },
      { label: 'Back Pocket (Peechay Jaib)', icon: '◨' },
      { label: 'No Pocket (Baghair Jaib)', icon: '×' },
    ],
  },
  {
    key: 'length',
    title: 'Length Type',
    helper: 'Lambai ka andaaz',
    type: 'radio',
    options: [
      { label: 'Ankle Length (Takhnay Tak)', icon: '↧' },
      { label: 'Full Length (Puri Lambai)', icon: '↓' },
      { label: 'Short Length (Choti Lambai)', icon: '↥' },
    ],
  },
  {
    key: 'collar',
    title: 'Collar Style',
    helper: 'Waistcoat/coat ka collar',
    type: 'radio',
    options: [
      { label: 'V Collar (V Gala)', icon: 'V' },
      { label: 'Round Collar (Gol Collar)', icon: '○' },
      { label: 'Band Collar (Ban Collar)', icon: '▯' },
      { label: 'Shawl Collar (Shawl Collar)', icon: '⌒' },
    ],
  },
  {
    key: 'button',
    title: 'Button Style',
    helper: 'Button laganay ka style',
    type: 'radio',
    options: [
      { label: 'Single Button Line (Single Patti)', icon: '•' },
      { label: 'Double Button Line (Double Patti)', icon: '••' },
      { label: 'Hidden Button Patti (Chupi Patti)', icon: '▦' },
      { label: 'Fancy Buttons (Fancy Button)', icon: '✦' },
    ],
  },
  {
    key: 'cuff',
    title: 'Cuff Style',
    helper: 'Kaf / aasteen end ka style',
    type: 'radio',
    options: [
      { label: 'Simple Cuff (Sada Kaf)', icon: '▭' },
      { label: 'Round Cuff (Gol Kaf)', icon: '◜' },
      { label: 'Button Cuff (Button Wala Kaf)', icon: '•' },
      { label: 'Open Sleeve (Khuli Aasteen)', icon: '⌵' },
    ],
  },
  {
    key: 'buttons',
    title: 'Button Types',
    helper: 'Extra button details',
    type: 'checkbox',
    options: [
      { label: 'Simple Button (Sada Button)', icon: '•' },
      { label: 'Fancy Button (Fancy Button)', icon: '✦' },
      { label: 'Metal Button (Dhati Button)', icon: '●' },
      { label: 'Covered Button (Kapray Wala Button)', icon: '◉' },
      { label: 'Hidden Patti (Chupi Patti)', icon: '▦' },
      { label: 'Double Button (Double Button)', icon: '••' },
    ],
  },
  {
    key: 'extras',
    title: 'Extra Details',
    helper: 'Khaas kaam ya finishing',
    type: 'checkbox',
    options: [
      { label: 'Side Pocket (Side Jaib)', icon: '◧' },
      { label: 'Front Pocket (Samne Jaib)', icon: '▣' },
      { label: 'Kaf Patti (Cuff Patti)', icon: '▤' },
      { label: 'Embroidery (Karhai)', icon: '✽' },
      { label: 'Piping (Piping)', icon: '│' },
      { label: 'Lace (Lace)', icon: '≈' },
      { label: 'Lining (Asthar)', icon: '▥' },
      { label: 'Chak Patti (Side Patti)', icon: '⇲' },
    ],
  },
]

const STYLE_GROUPS_BY_GARMENT: Record<GarmentType, StyleKey[]> = {
  shalwar_kameez: ['neck', 'sleeve', 'daman', 'fit', 'extras'],
  kurta: ['neck', 'sleeve', 'daman', 'fit', 'extras'],
  kurti: ['neck', 'sleeve', 'daman', 'fit', 'extras'],
  shirt: ['neck', 'sleeve', 'fit', 'pocket'],
  trouser: ['bottom', 'fit', 'pocket'],
  pajama: ['bottom', 'fit'],
  sherwani: ['collar', 'button', 'fit', 'extras'],
  waistcoat: ['collar', 'button', 'fit', 'pocket'],
  prince_coat: ['collar', 'button', 'fit', 'pocket'],
  pant_coat: ['collar', 'button', 'bottom', 'fit', 'pocket'],
  lehenga: ['neck', 'sleeve', 'fit', 'extras'],
  maxi: ['neck', 'sleeve', 'fit', 'extras'],
  blazer: ['collar', 'button', 'fit', 'pocket'],
  jacket: ['collar', 'button', 'fit', 'pocket'],
  other: ['fit', 'extras'],
}

const STYLE_ICON_OVERRIDES: Record<string, string> = {
  'Round Neck (Gol Gala)': '⭕',
  'Ban Collar (Ban Gala)': '👔',
  'V Neck (V Gala)': '🔻',
  'Collar Neck (Collar Gala)': '👕',
  'Sherwani Collar (Sherwani Gala)': '🤵',
  'Chinese Collar (Cheeni Gala)': '👔',
  'Round Daman (Gol Daman)': '🌙',
  'Square Daman (Chokor Daman)': '⬜',
  'Round Cut Daman (Gol Cut Daman)': '〰️',
  'Side Cut Daman (Side Chak)': '↔️',
  'Straight Daman (Seedha Daman)': '➖',
  'Full Sleeve (Puri Aasteen)': '🧥',
  'Half Sleeve (Aadhi Aasteen)': '👕',
  'Cuff Sleeve (Kaf Aasteen)': '🔘',
  'Loose Sleeve (Khuli Aasteen)': '〰️',
  'Straight Sleeve (Seedhi Aasteen)': '📏',
  'Slim Fit (Chipka Fit)': '📏',
  'Regular Fit (Normal Fit)': '✅',
  'Loose Fit (Khula Fit)': '↔️',
  'Straight Bottom (Seedha Paincha)': '➖',
  'Narrow Bottom (Tang Paincha)': '📐',
  'Wide Bottom (Khula Paincha)': '↔️',
  'Cuffed Bottom (Mori Wala Paincha)': '🔘',
  'Side Pocket (Side Jaib)': '🧵',
  'Front Pocket (Samne Jaib)': '⬛',
  'Back Pocket (Peechay Jaib)': '↩️',
  'No Pocket (Baghair Jaib)': '🚫',
  'Ankle Length (Takhnay Tak)': '🦶',
  'Full Length (Puri Lambai)': '📏',
  'Short Length (Choti Lambai)': '↕️',
  'V Collar (V Gala)': '🔻',
  'Round Collar (Gol Collar)': '⭕',
  'Band Collar (Ban Collar)': '👔',
  'Shawl Collar (Shawl Collar)': '🧣',
  'Single Button Line (Single Patti)': '🔘',
  'Double Button Line (Double Patti)': '🔘🔘',
  'Hidden Button Patti (Chupi Patti)': '🙈',
  'Fancy Buttons (Fancy Button)': '✨',
  'Simple Cuff (Sada Kaf)': '➖',
  'Round Cuff (Gol Kaf)': '⭕',
  'Button Cuff (Button Wala Kaf)': '🔘',
  'Open Sleeve (Khuli Aasteen)': '↔️',
  'Simple Button (Sada Button)': '🔘',
  'Fancy Button (Fancy Button)': '✨',
  'Metal Button (Dhati Button)': '⚙️',
  'Covered Button (Kapray Wala Button)': '🧵',
  'Double Button (Double Button)': '🔘🔘',
  'Kaf Patti (Cuff Patti)': '🔘',
  'Embroidery (Karhai)': '🌸',
  'Piping (Piping)': '〰️',
  'Lace (Lace)': '🎀',
  'Lining (Asthar)': '🧥',
  'Chak Patti (Side Patti)': '↔️',
  Other: '✏️',
}

function withStyleIconsAndOther(group: StyleGroup): StyleGroup {
  const hasOther = group.options.some(option => option.label === 'Other')
  return {
    ...group,
    options: [
      ...group.options.map(option => ({
        ...option,
        icon: STYLE_ICON_OVERRIDES[option.label] ?? option.icon,
      })),
      ...(hasOther ? [] : [{ label: 'Other', icon: STYLE_ICON_OVERRIDES.Other }]),
    ],
  }
}

function getStyleGroupsForGarment(type?: GarmentType): StyleGroup[] {
  if (!type) return []
  const keys = STYLE_GROUPS_BY_GARMENT[type] ?? []
  return keys
    .map(key => STYLE_GROUPS.find(group => group.key === key))
    .filter(Boolean)
    .map(group => withStyleIconsAndOther(group as StyleGroup))
}

const otherPrefix = 'Other: '

function isOtherStyleValue(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(otherPrefix)
}

function otherStyleText(value: unknown): string {
  return isOtherStyleValue(value) ? value.slice(otherPrefix.length) : ''
}

function optionIsSelected(value: StyleSelections[StyleKey], optionLabel: string): boolean {
  if (Array.isArray(value)) {
    return optionLabel === 'Other'
      ? value.some(isOtherStyleValue)
      : value.includes(optionLabel)
  }
  return optionLabel === 'Other'
    ? isOtherStyleValue(value)
    : value === optionLabel
}

export function formatStyleSelections(styles: StyleSelections): string {
  const labels: string[] = []
  STYLE_GROUPS.forEach((group) => {
    const value = styles[group.key]
    if (Array.isArray(value) && value.length > 0) labels.push(`${group.title}: ${value.join(', ')}`)
    if (typeof value === 'string' && value) labels.push(`${group.title}: ${value}`)
  })
  return labels.length ? `Style: ${labels.join(' | ')}` : ''
}

interface Step2Props {
  data: {
    garmentType?: GarmentType
    customerId?: string
    customerGender?: 'male' | 'female' | 'child'
    orderForRelation?: OrderRecipientRelation
    orderForName?: string
    recipientGender?: 'male' | 'female' | 'child'
    measurementId?: string
    measurements?: Record<string, string>
    styleSelections?: StyleSelections
    specialInstructions?: string
    isUrgent?: boolean
    fabricPhotoBase64?: string
  }
  onUpdate: (d: Partial<{
    garmentType: GarmentType | undefined
    orderForRelation: OrderRecipientRelation
    orderForName: string | undefined
    recipientGender: 'male' | 'female' | 'child'
    measurementId: string | undefined
    measurements: Record<string, string>
    styleSelections: StyleSelections
    specialInstructions: string
    isUrgent: boolean
    fabricPhotoBase64?: string
  }>) => void
  onNext: () => void
}

export function Step2Garment({ data, onUpdate, onNext }: Step2Props) {
  const [measurements, setMeasurements] = useState<Record<string, string>>(
    data.measurements || {}
  )
  const [styleSelections, setStyleSelections] = useState<StyleSelections>(
    data.styleSelections || {}
  )
  const selectedRelation = data.orderForRelation ?? 'self'
  const recipientGender = inferRecipientGender(selectedRelation, data.customerGender, data.recipientGender)
  const allowedRelations = RECIPIENTS_BY_CUSTOMER[data.customerGender ?? 'male']
  const visibleGarmentTypes = GARMENTS_BY_RECIPIENT[recipientGender]

  useEffect(() => {
    if (allowedRelations.includes(selectedRelation)) return
    updateRecipient('self')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.customerGender, selectedRelation])

  // Add state inside Step2Garment:
  const [quickPhoto, setQuickPhoto] = useState<string | null>(data.fabricPhotoBase64 ?? null)
  const [takingPhoto, setTakingPhoto] = useState(false)

  const handleQuickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setTakingPhoto(true)
    try {
      const result = await compressImage(file)
      setQuickPhoto(result.base64)
      onUpdate({ fabricPhotoBase64: result.base64 })
    } finally {
      setTakingPhoto(false)
    }
  }

  const selectedType = data.garmentType
  const fields = selectedType ? MEASUREMENT_FIELDS[selectedType] : []
  const visibleStyleGroups = getStyleGroupsForGarment(selectedType)
  const [previousMeasurements, setPreviousMeasurements] = useState<MeasurementRecord[]>([])
  const [knownRecipients, setKnownRecipients] = useState<KnownRecipient[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!data.customerId || !relationNeedsName(selectedRelation)) {
        setKnownRecipients([])
        return
      }

      const [measurementRes, orderRes] = await Promise.all([
        (supabase as any)
          .from('measurements')
          .select('order_for_name,recipient_gender,taken_at')
          .eq('customer_id', data.customerId)
          .eq('order_for_relation', selectedRelation)
          .not('order_for_name', 'is', null)
          .is('deleted_at', null)
          .order('taken_at', { ascending: false }),
        (supabase as any)
          .from('orders')
          .select('order_for_name,recipient_gender,created_at')
          .eq('customer_id', data.customerId)
          .eq('order_for_relation', selectedRelation)
          .not('order_for_name', 'is', null)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
      ])

      if (measurementRes.error) throw new Error(measurementRes.error.message)
      if (orderRes.error) throw new Error(orderRes.error.message)

      const byName = new Map<string, KnownRecipient>()
      ;[
        ...(measurementRes.data ?? []).map((row: any) => ({
          name: row.order_for_name,
          gender: row.recipient_gender,
          lastUsedAt: row.taken_at,
        })),
        ...(orderRes.data ?? []).map((row: any) => ({
          name: row.order_for_name,
          gender: row.recipient_gender,
          lastUsedAt: row.created_at,
        })),
      ].forEach((item: KnownRecipient) => {
        const cleanName = item.name?.trim()
        if (!cleanName) return
        const key = normalizeRecipientName(cleanName)
        const current = byName.get(key)
        if (!current || item.lastUsedAt > current.lastUsedAt) {
          byName.set(key, { ...item, name: cleanName })
        }
      })

      if (!cancelled) {
        setKnownRecipients(
          [...byName.values()].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
        )
      }
    }

    load().catch(console.error)
    return () => { cancelled = true }
  }, [data.customerId, selectedRelation])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!data.customerId || !selectedType) {
        setPreviousMeasurements([])
        return
      }
      const { data: rows, error } = await (supabase as any)
        .from('measurements')
        .select('*')
        .eq('customer_id', data.customerId)
        .eq('garment_type', selectedType)
        .is('deleted_at', null)
        .order('taken_at', { ascending: false })
      if (error) throw new Error(error.message)
      const matching = (rows ?? [])
        .map(mapMeasurement)
        .filter((measurement: MeasurementRecord) =>
          measurementMatchesRecipient(measurement, selectedRelation, data.orderForName, recipientGender)
        )
      if (!cancelled) setPreviousMeasurements(matching)
    }
    load().catch(console.error)
    return () => { cancelled = true }
  }, [data.customerId, selectedType, selectedRelation, data.orderForName, recipientGender])
  const selectedPrevious = previousMeasurements.find(m => m.id === data.measurementId)

  const updateMeasurement = (key: string, value: string) => {
    const updated = { ...measurements, [key]: value }
    setMeasurements(updated)
    onUpdate({ measurements: updated, measurementId: undefined })
  }

  const updateStyle = (key: keyof StyleSelections, value: string, multi: boolean) => {
    const current = styleSelections[key]
    if (value === 'Other') {
      const nextOther = `${otherPrefix}${otherStyleText(current)}`
      const updated: StyleSelections = {
        ...styleSelections,
        [key]: multi
          ? (Array.isArray(current) && current.some(isOtherStyleValue)
              ? current.filter(item => !isOtherStyleValue(item))
              : [...(Array.isArray(current) ? current : []), nextOther])
          : nextOther,
      }
      setStyleSelections(updated)
      onUpdate({ styleSelections: updated })
      return
    }
    const updated: StyleSelections = {
      ...styleSelections,
      [key]: multi
        ? (Array.isArray(current) && current.includes(value)
            ? current.filter(item => item !== value)
            : [...(Array.isArray(current) ? current : []), value])
        : value,
    }
    setStyleSelections(updated)
    onUpdate({ styleSelections: updated })
  }

  const updateOtherStyle = (key: keyof StyleSelections, value: string, multi: boolean) => {
    const custom = `${otherPrefix}${value}`
    const current = styleSelections[key]
    const updated: StyleSelections = {
      ...styleSelections,
      [key]: multi
        ? [
            ...(Array.isArray(current) ? current.filter(item => !isOtherStyleValue(item)) : []),
            custom,
          ]
        : custom,
    }
    setStyleSelections(updated)
    onUpdate({ styleSelections: updated })
  }

  const updateRecipient = (relation: OrderRecipientRelation) => {
    const nextGender = inferRecipientGender(relation, data.customerGender)
    setMeasurements({})
    setStyleSelections({})
    onUpdate({
      orderForRelation: relation,
      orderForName: relationNeedsName(relation) ? '' : undefined,
      recipientGender: nextGender,
      garmentType: undefined,
      measurements: {},
      measurementId: undefined,
      styleSelections: {},
    })
  }

  const selectKnownRecipient = (recipient: KnownRecipient) => {
    setMeasurements({})
    setStyleSelections({})
    onUpdate({
      orderForName: recipient.name,
      recipientGender: recipient.gender ?? inferRecipientGender(selectedRelation, data.customerGender, data.recipientGender),
      measurementId: undefined,
      measurements: {},
      styleSelections: {},
    })
  }

  const addNewRecipient = () => {
    setMeasurements({})
    setStyleSelections({})
    onUpdate({
      orderForName: '',
      measurementId: undefined,
      measurements: {},
      styleSelections: {},
    })
  }

  const filledCount = Object.values(measurements).filter(v => v && v !== '0').length
  const canProceed = !!selectedType && (!!data.measurementId || filledCount > 0)

  return (
    <div className="space-y-6 mb-16 lg:mb-0">

      <div>
        <p className="text-sm font-semibold text-slate-700 mb-3">
          Ye order kis ke liye hai? <span className="text-red-500">*</span>
        </p>
        <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
          {RECIPIENT_OPTIONS.filter(option => allowedRelations.includes(option.relation)).map(option => {
            const selected = selectedRelation === option.relation
            return (
              <button
                key={option.relation}
                type="button"
                onClick={() => updateRecipient(option.relation)}
                className={cn(
                  'flex min-h-20 flex-col items-start justify-between rounded-2xl border-2 px-3 py-3 text-left transition-all active:scale-[0.98]',
                  selected
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                )}
              >
                <UsersRound size={17} className={selected ? 'text-blue-600' : 'text-slate-400'} />
                <span>
                  <span className="block text-sm font-bold">{option.label}</span>
                  <span className="block text-[10px] text-slate-400">{option.helper}</span>
                </span>
              </button>
            )
          })}
        </div>

        {relationNeedsName(selectedRelation) && (
          <div className="mt-3 space-y-3">
            {knownRecipients.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-bold text-slate-500">
                  Purane {relationLabel(selectedRelation)} select karein
                </p>
                <div className="flex flex-wrap gap-2">
                  {knownRecipients.map(recipient => {
                    const selected = normalizeRecipientName(data.orderForName) === normalizeRecipientName(recipient.name)
                    return (
                      <button
                        key={normalizeRecipientName(recipient.name)}
                        type="button"
                        onClick={() => selectKnownRecipient(recipient)}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-xs font-bold transition-colors',
                          selected
                            ? 'border-blue-500 bg-blue-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
                        )}
                      >
                        {recipient.name}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={addNewRecipient}
                    className="rounded-xl border border-dashed border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-700"
                  >
                    Naya {relationLabel(selectedRelation)}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-500">
                  {selectedRelation === 'other' ? 'Relation / Name' : `${relationLabel(selectedRelation)} ka naam (optional)`}
                </span>
                <input
                  type="text"
                  value={data.orderForName ?? ''}
                  onChange={e => {
                    setMeasurements({})
                    onUpdate({
                      orderForName: e.target.value.trimStart() || undefined,
                      measurementId: undefined,
                      measurements: {},
                    })
                  }}
                  placeholder={selectedRelation === 'other' ? 'Jaise: Cousin Ahmed' : 'Jaise: Ahmed'}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-blue-50/30 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['male', 'female', 'child'] as const).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setMeasurements({})
                      setStyleSelections({})
                      onUpdate({
                        recipientGender: g,
                        garmentType: undefined,
                        measurementId: undefined,
                        measurements: {},
                        styleSelections: {},
                      })
                    }}
                    className={cn(
                      'rounded-xl border-2 px-3 py-2 text-xs font-bold capitalize',
                      recipientGender === g
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-500'
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Garment type picker — big icon buttons */}
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-3">
          Kapra Kaisa Hai? <span className="text-red-500">*</span>
          <span className="ml-2 text-xs font-normal text-slate-400">
            ({relationLabel(selectedRelation)} - {recipientGender})
          </span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(GARMENT_LABELS) as [GarmentType, { label: string; emoji: string }][])
            .filter(([type]) => visibleGarmentTypes.includes(type))
            .map(
            ([type, { label, emoji }]) => {
              const isSelected = type === selectedType
              return (
                <button
                  key={type}
                  onClick={() => {
                    if (type === selectedType) return
                    setMeasurements({})
                    setStyleSelections({})
                    onUpdate({ garmentType: type, measurements: {}, measurementId: undefined, styleSelections: {} })
                  }}
                  className={cn(
                    'flex flex-col items-center gap-2 py-4 rounded-2xl border-2',
                    'transition-all active:scale-95',
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  )}
                >
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-[11px] font-semibold leading-tight text-center">
                    {label}
                  </span>
                  <span className="px-1 text-center text-[9px] leading-tight text-slate-400">
                    {FABRIC_HINTS[type]}
                  </span>
                </button>
              )
            }
          )}
        </div>
      </div>

      {/* Urgent toggle */}
      <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertCircle size={18} className="text-orange-600" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Urgent Order?</p>
            <p className="text-xs text-orange-500">Jaldi banana zaroor hai</p>
          </div>
        </div>
        <ToggleSwitch
          checked={!!data.isUrgent}
          onCheckedChange={(checked) => onUpdate({ isUrgent: checked })}
          label="Urgent Order"
          activeClassName="bg-orange-500"
        />
      </div>

      {/* Measurements — only shows after garment type selected */}
      {selectedType && (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-1">
            {napOwnerLabel({ relation: selectedRelation, name: data.orderForName, garmentType: selectedType })}
          </p>
          <p className="text-xs text-slate-400 mb-3">
            Naye customer/order ke liye nap zaroori hai. Purani nap use karein ya nayi nap bharein.
          </p>
          {previousMeasurements.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500">Purani nap</p>
              {previousMeasurements.slice(0, 3).map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMeasurements(m.values)
                    onUpdate({ measurementId: m.id, measurements: m.values })
                  }}
                  className={cn(
                    'w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
                    data.measurementId === m.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white'
                  )}
                >
                  <span className="block text-xs font-bold text-slate-700">
                    {idx === 0 ? `Latest ${recipientLabel(m.orderForRelation, m.orderForName)} nap` : `${recipientLabel(m.orderForRelation, m.orderForName)} nap ${idx + 1}`}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    {new Date(m.takenAt).toLocaleDateString('en-PK')} · {Object.values(m.values).filter(Boolean).length} fields
                  </span>
                </button>
              ))}
              {selectedPrevious && (
                <button
                  type="button"
                  onClick={() => {
                    setMeasurements({})
                    onUpdate({ measurementId: undefined, measurements: {} })
                  }}
                  className="text-xs font-semibold text-blue-600"
                >
                  Nayi nap likhein
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {fields.map(({ key, label, unit }) => (
              <div key={key} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  {label}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={measurements[key] || ''}
                    disabled={!!selectedPrevious}
                    onChange={e => updateMeasurement(key, e.target.value)}
                    className="flex-1 w-full text-sm font-semibold text-slate-800
                               bg-transparent outline-none disabled:text-slate-500"
                  />
                  <span className="text-[10px] text-slate-400 shrink-0">{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Style reference options */}
      {selectedType && (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-bold text-slate-800">
                Style Reference
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Sirf zaroori style choices select karein. Extra detail notes mein likh dein.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700">
              {visibleStyleGroups.length} fields
            </span>
          </div>
          <div className="space-y-5">
            {visibleStyleGroups.map((group) => (
              <div key={group.key}>
                <div className="mb-2">
                  <p className="text-sm font-bold text-slate-700">{group.title}</p>
                  <p className="text-[11px] text-slate-400">{group.helper}</p>
                </div>
                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
                  {group.options.map((option) => {
                    const value = styleSelections[group.key]
                    const selected = optionIsSelected(value, option.label)
                    const multi = group.type === 'checkbox'
                    const otherSelected = option.label === 'Other' && selected
                    return (
                      <div key={option.label} className="space-y-2">
                        <button
                          type="button"
                          onClick={() => updateStyle(group.key, option.label, multi)}
                          className={cn(
                            'group flex min-h-18 w-full items-center gap-3 rounded-2xl border-2 px-3 py-3 text-left transition-all active:scale-[0.98]',
                            selected
                              ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                          )}
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xl">
                            {option.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold leading-snug">{option.label}</span>
                            {option.hint && <span className="mt-0.5 block text-[10px] text-slate-400">{option.hint}</span>}
                          </span>
                          {selected && (
                            <CheckCircle2 size={17} className="shrink-0 text-blue-600" />
                          )}
                        </button>
                        {otherSelected && (
                          <label className="block rounded-2xl border border-blue-200 bg-white p-2.5 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                            <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                              <AlertCircle size={11} />
                              Custom style
                            </span>
                            <input
                              type="text"
                              value={Array.isArray(value)
                                ? otherStyleText(value.find(isOtherStyleValue))
                                : otherStyleText(value)}
                              onChange={e => updateOtherStyle(group.key, e.target.value, multi)}
                              placeholder="Apna style likhein..."
                              className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                            />
                          </label>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          {formatStyleSelections(styleSelections) && (
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-700">Selected Style Summary</p>
              <div className="flex flex-wrap gap-2">
                {visibleStyleGroups.flatMap(group => {
                  const value = styleSelections[group.key]
                  const values = Array.isArray(value) ? value : value ? [value] : []
                  return values.map(item => (
                    <span
                      key={`${group.key}-${item}`}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-[11px] font-semibold',
                        isOtherStyleValue(item)
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-blue-200 bg-white text-blue-800'
                      )}
                    >
                      <span className="text-slate-500">{group.title}:</span>{' '}
                      {isOtherStyleValue(item) ? otherStyleText(item) || 'Custom style' : item}
                    </span>
                  ))
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Special instructions */}
      {selectedType && (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Koi Khaas Baat? (Optional)
          </label>
          <textarea
            placeholder="Jaise: pocket wala banana, kali button lagana..."
            value={data.specialInstructions || ''}
            onChange={e => onUpdate({ specialInstructions: e.target.value })}
            rows={3}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl
                       text-sm outline-none focus:border-blue-500 resize-none
                       placeholder:text-slate-400 transition-colors"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Kapre Ki Photo (Optional)
        </label>
        {quickPhoto ? (
          <div className="relative">
            <img
              src={quickPhoto}
              alt="Fabric"
              className="w-full h-40 object-cover rounded-2xl"
            />
            <button
              aria-label="Remove fabric photo"
              onClick={() => { setQuickPhoto(null); onUpdate({ fabricPhotoBase64: undefined }) }}
              className="absolute top-2 right-2 w-11 h-11 bg-red-500 text-white
                   rounded-full flex items-center justify-center text-sm font-bold"
            >
              ✕
            </button>
          </div>
        ) : (
          <label className={cn(
            'flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed',
            'border-slate-300 rounded-2xl bg-slate-50 cursor-pointer',
            'hover:border-blue-400 hover:bg-blue-50 transition-colors'
          )}>
            {takingPhoto
              ? <Loader2 size={24} className="text-blue-600 animate-spin" />
              : <Camera size={24} className="text-slate-400" />
            }
            <span className="text-xs text-slate-500 font-medium">
              {takingPhoto ? 'Photo le raha hai...' : 'Camera se photo len'}
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleQuickPhoto}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Next button */}
      <div className="fixed inset-x-0 bottom-0 w-full bg-white border-t border-slate-100 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]
                      lg:static lg:max-w-none lg:pb-4 mb-16 lg:mb-0">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed
                     text-white font-bold py-4 rounded-2xl text-base
                     transition-colors active:scale-[0.98]"
        >
          {canProceed ? 'Payment Details →' : selectedType ? 'Nap select ya fill karein' : 'Pehle Kapra Chunein'}
        </button>
      </div>
      <div className="h-24 lg:h-0" />
    </div>
  )
}
