// src/components/orders/wizard/Step2Garment.tsx
'use client'

import Image from 'next/image'
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
    { key: 'length', label: 'Length (لمبائی)', unit: 'inch' },
    { key: 'chest', label: 'Chest (سینہ)', unit: 'inch' },
    { key: 'waist', label: 'Waist (کمر)', unit: 'inch' },
    { key: 'hip', label: 'Hip (کولہا)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (کندھا)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (آستین)', unit: 'inch' },
    { key: 'armhole', label: 'Armhole (بازو گولائی)', unit: 'inch' },
    { key: 'bicep', label: 'Bicep (بازو)', unit: 'inch' },
    { key: 'collar', label: 'Collar (گریبان)', unit: 'inch' },
    { key: 'front_neck', label: 'Front Neck (اگلا گلا)', unit: 'inch' },
    { key: 'back_neck', label: 'Back Neck (پچھلا گلا)', unit: 'inch' },
    { key: 'trouser_length', label: 'Shalwar Length (شلوار لمبائی)', unit: 'inch' },
    { key: 'trouser_waist', label: 'Shalwar Waist (ناڑہ)', unit: 'inch' },
    { key: 'thigh', label: 'Thigh (ران)', unit: 'inch' },
    { key: 'knee', label: 'Knee (گھٹنا)', unit: 'inch' },
    { key: 'bottom', label: 'Bottom (پائنچہ)', unit: 'inch' },
  ],
  kurta: [
    { key: 'length', label: 'Length (لمبائی)', unit: 'inch' },
    { key: 'chest', label: 'Chest (سینہ)', unit: 'inch' },
    { key: 'waist', label: 'Waist (کمر)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (کندھا)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (آستین)', unit: 'inch' },
    { key: 'collar', label: 'Collar (گلا)', unit: 'inch' },
    { key: 'bottom', label: 'Daman Width (دامن)', unit: 'inch' },
  ],
  kurti: [
    { key: 'length', label: 'Length (لمبائی)', unit: 'inch' },
    { key: 'chest', label: 'Chest (سینہ)', unit: 'inch' },
    { key: 'waist', label: 'Waist (کمر)', unit: 'inch' },
    { key: 'hip', label: 'Hip (کولہا)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (کندھا)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (آستین)', unit: 'inch' },
  ],
  shirt: [
    { key: 'length', label: 'Length (لمبائی)', unit: 'inch' },
    { key: 'chest', label: 'Chest (سینہ)', unit: 'inch' },
    { key: 'waist', label: 'Waist (کمر)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (کندھا)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (آستین)', unit: 'inch' },
    { key: 'collar', label: 'Collar (گریبان)', unit: 'inch' },
    { key: 'cuff', label: 'Cuff (کف)', unit: 'inch' },
  ],
  trouser: [
    { key: 'trouser_length', label: 'Length (لمبائی)', unit: 'inch' },
    { key: 'trouser_waist', label: 'Waist (کمر)', unit: 'inch' },
    { key: 'hip', label: 'Hip (سرین)', unit: 'inch' },
    { key: 'thigh', label: 'Thigh (ران)', unit: 'inch' },
    { key: 'knee', label: 'Knee (گھٹنا)', unit: 'inch' },
    { key: 'bottom', label: 'Bottom (پائنچہ)', unit: 'inch' },
  ],
  pajama: [
    { key: 'trouser_length', label: 'Length (لمبائی)', unit: 'inch' },
    { key: 'trouser_waist', label: 'Waist (ناڑہ)', unit: 'inch' },
    { key: 'hip', label: 'Hip (سرین)', unit: 'inch' },
    { key: 'thigh', label: 'Thigh (ران)', unit: 'inch' },
    { key: 'bottom', label: 'Bottom (پائنچہ)', unit: 'inch' },
  ],
  sherwani: [
    { key: 'length', label: 'Length (لمبائی)', unit: 'inch' },
    { key: 'chest', label: 'Chest (سینہ)', unit: 'inch' },
    { key: 'waist', label: 'Waist (کمر)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (کندھا)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (آستین)', unit: 'inch' },
    { key: 'hip', label: 'Hip (کولہا)', unit: 'inch' },
  ],
  waistcoat: [
    { key: 'length', label: 'Length (لمبائی)', unit: 'inch' },
    { key: 'chest', label: 'Chest (سینہ)', unit: 'inch' },
    { key: 'waist', label: 'Waist (کمر)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (کندھا)', unit: 'inch' },
  ],
  prince_coat: [
    { key: 'length', label: 'Length (لمبائی)', unit: 'inch' },
    { key: 'chest', label: 'Chest (سینہ)', unit: 'inch' },
    { key: 'waist', label: 'Waist (کمر)', unit: 'inch' },
    { key: 'hip', label: 'Hip (کولہا)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (کندھا)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (آستین)', unit: 'inch' },
  ],
  pant_coat: [
    { key: 'length', label: 'Length (لمبائی)', unit: 'inch' },
    { key: 'chest', label: 'Chest (سینہ)', unit: 'inch' },
    { key: 'waist', label: 'Waist (کمر)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (کندھا)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (آستین)', unit: 'inch' },
    { key: 'trouser_length', label: 'Pant Length', unit: 'inch' },
    { key: 'trouser_waist', label: 'Pant Waist', unit: 'inch' },
  ],
  lehenga: [
    { key: 'length', label: 'Lehenga Length (لہنگا)', unit: 'inch' },
    { key: 'waist', label: 'Waist (کمر)', unit: 'inch' },
    { key: 'hip', label: 'Hip (کولہا)', unit: 'inch' },
    { key: 'chest', label: 'Blouse Chest', unit: 'inch' },
    { key: 'shoulder', label: 'Blouse Shoulder', unit: 'inch' },
    { key: 'sleeve', label: 'Blouse Sleeve', unit: 'inch' },
  ],
  maxi: [
    { key: 'length', label: 'Full Length', unit: 'inch' },
    { key: 'chest', label: 'Chest (سینہ)', unit: 'inch' },
    { key: 'waist', label: 'Waist (کمر)', unit: 'inch' },
    { key: 'hip', label: 'Hip (کولہا)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (کندھا)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (آستین)', unit: 'inch' },
  ],
  blazer: [
    { key: 'length', label: 'Length (لمبائی)', unit: 'inch' },
    { key: 'chest', label: 'Chest (سینہ)', unit: 'inch' },
    { key: 'waist', label: 'Waist (کمر)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (کندھا)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (آستین)', unit: 'inch' },
  ],
  jacket: [
    { key: 'length', label: 'Length (لمبائی)', unit: 'inch' },
    { key: 'chest', label: 'Chest (سینہ)', unit: 'inch' },
    { key: 'waist', label: 'Waist (کمر)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (کندھا)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (آستین)', unit: 'inch' },
  ],
  other: [
    { key: 'length', label: 'Length (لمبائی)', unit: 'inch' },
    { key: 'chest', label: 'Chest (سینہ)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (کندھا)', unit: 'inch' },
    { key: 'waist', label: 'Waist (کمر)', unit: 'inch' },
  ],
}

const SHALWAR_KAMEEZ_KAMEEZ_KEYS = new Set([
  'length',
  'chest',
  'waist',
  'hip',
  'shoulder',
  'sleeve',
  'armhole',
  'bicep',
  'collar',
  'front_neck',
  'back_neck',
])

function measurementSections(
  type: GarmentType,
  fields: { key: string; label: string; unit: string }[],
) {
  if (type !== 'shalwar_kameez') {
    return [{ title: 'Nap / Measurements', helper: '', fields }]
  }

  return [
    {
      title: 'Kameez Nap',
      helper: 'Kameez ke upper-body measurements',
      fields: fields.filter(field => SHALWAR_KAMEEZ_KAMEEZ_KEYS.has(field.key)),
    },
    {
      title: 'Shalwar Nap',
      helper: 'Shalwar ke lower measurements',
      fields: fields.filter(field => !SHALWAR_KAMEEZ_KAMEEZ_KEYS.has(field.key)),
    },
  ]
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
      { label: 'Round Neck (گول گلا)', icon: '○' },
      { label: 'Ban Collar (بان گلا)', icon: '▯' },
      { label: 'V Neck (وی گلا)', icon: 'V' },
      { label: 'Collar Neck (کالر گلا)', icon: '⌑' },
      { label: 'Sherwani Collar (شیروانی گلا)', icon: '▰' },
      { label: 'Chinese Collar (چینی گلا)', icon: '▱' },
    ],
  },
  {
    key: 'daman',
    title: 'Daman Style (دامن)',
    helper: 'Kameez/kurta ka neeche wala cut',
    type: 'radio',
    options: [
      { label: 'Round Daman (گول دامن)', icon: '◠' },
      { label: 'Square Daman (چوکور دامن)', icon: '□' },
      { label: 'Round Cut Daman (گول کٹ دامن)', icon: '⌒' },
      { label: 'Side Cut Daman (سائیڈ چاک)', icon: '⇲' },
      { label: 'Straight Daman (سیدھا دامن)', icon: '▬' },
    ],
  },
  {
    key: 'sleeve',
    title: 'Sleeve Style (آستین)',
    helper: 'Aasteen ka style',
    type: 'radio',
    options: [
      { label: 'Full Sleeve (پوری آستین)', icon: '┃' },
      { label: 'Half Sleeve (آدھی آستین)', icon: '╻' },
      { label: 'Cuff Sleeve (کف آستین)', icon: '▣' },
      { label: 'Loose Sleeve (کھلی آستین)', icon: '◫' },
      { label: 'Straight Sleeve (سیدھی آستین)', icon: '▌' },
    ],
  },
  {
    key: 'fit',
    title: 'Fit Type (فٹ)',
    helper: 'Kapray ki fitting',
    type: 'radio',
    options: [
      { label: 'Slim Fit (چپکا فٹ)', icon: 'S' },
      { label: 'Regular Fit (نارمل فٹ)', icon: 'R' },
      { label: 'Loose Fit (کھلا فٹ)', icon: 'L' },
    ],
  },
  {
    key: 'bottom',
    title: 'Bottom Style (پائنچہ)',
    helper: 'Paincha / bottom ka cut',
    type: 'radio',
    options: [
      { label: 'Straight Bottom (سیدھا پائنچہ)', icon: '║' },
      { label: 'Narrow Bottom (تنگ پائنچہ)', icon: '⌯' },
      { label: 'Wide Bottom (کھلا پائنچہ)', icon: '⌵' },
      { label: 'Cuffed Bottom (موری والا پائنچہ)', icon: '▤' },
    ],
  },
  {
    key: 'pocket',
    title: 'Pocket Style (جیب)',
    helper: 'Jaib ka style',
    type: 'radio',
    options: [
      { label: 'Side Pocket (سائیڈ جیب)', icon: '◧' },
      { label: 'Front Pocket (سامنے جیب)', icon: '▣' },
      { label: 'Back Pocket (پیچھے جیب)', icon: '◨' },
      { label: 'No Pocket (بغیر جیب)', icon: '×' },
    ],
  },
  {
    key: 'length',
    title: 'Length Type (لمبائی)',
    helper: 'Lambai ka andaaz',
    type: 'radio',
    options: [
      { label: 'Ankle Length (ٹخنے تک)', icon: '↧' },
      { label: 'Full Length (پوری لمبائی)', icon: '↓' },
      { label: 'Short Length (چھوٹی لمبائی)', icon: '↥' },
    ],
  },
  {
    key: 'collar',
    title: 'Collar Style (کالر)',
    helper: 'Waistcoat/coat ka collar',
    type: 'radio',
    options: [
      { label: 'V Collar (وی گلا)', icon: 'V' },
      { label: 'Round Collar (گول کالر)', icon: '○' },
      { label: 'Band Collar (بینڈ کالر)', icon: '▯' },
      { label: 'Shawl Collar (شال کالر)', icon: '⌒' },
    ],
  },
  {
    key: 'button',
    title: 'Button Style (بٹن)',
    helper: 'Button laganay ka style',
    type: 'radio',
    options: [
      { label: 'Single Button Line (سنگل پٹی)', icon: '•' },
      { label: 'Double Button Line (ڈبل پٹی)', icon: '••' },
      { label: 'Hidden Button Patti (چھپی پٹی)', icon: '▦' },
      { label: 'Fancy Buttons (فینسی بٹن)', icon: '✦' },
    ],
  },
  {
    key: 'cuff',
    title: 'Cuff Style (کف)',
    helper: 'Kaf / aasteen end ka style',
    type: 'radio',
    options: [
      { label: 'Simple Cuff (سادہ کف)', icon: '▭' },
      { label: 'Round Cuff (گول کف)', icon: '◜' },
      { label: 'Button Cuff (بٹن والا کف)', icon: '•' },
      { label: 'Open Sleeve (کھلی آستین)', icon: '⌵' },
    ],
  },
  {
    key: 'buttons',
    title: 'Button Types (بٹن)',
    helper: 'Extra button details',
    type: 'checkbox',
    options: [
      { label: 'Simple Button (سادہ بٹن)', icon: '•' },
      { label: 'Fancy Button (فینسی بٹن)', icon: '✦' },
      { label: 'Metal Button (دھاتی بٹن)', icon: '●' },
      { label: 'Covered Button (کپڑے والا بٹن)', icon: '◉' },
      { label: 'Hidden Patti (چھپی پٹی)', icon: '▦' },
      { label: 'Double Button (ڈبل بٹن)', icon: '••' },
    ],
  },
  {
    key: 'extras',
    title: 'Extra Details (اضافی)',
    helper: 'Khaas kaam ya finishing',
    type: 'checkbox',
    options: [
      { label: 'Side Pocket (سائیڈ جیب)', icon: '◧' },
      { label: 'Front Pocket (سامنے جیب)', icon: '▣' },
      { label: 'Kaf Patti (کف پٹی)', icon: '▤' },
      { label: 'Embroidery (کڑھائی)', icon: '✽' },
      { label: 'Piping (پائپنگ)', icon: '│' },
      { label: 'Lace (لیس)', icon: '≈' },
      { label: 'Lining (استر)', icon: '▥' },
      { label: 'Chak Patti (چاک پٹی)', icon: '⇲' },
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
  'Round Neck (گول گلا)': '⭕',
  'Ban Collar (بان گلا)': '👔',
  'V Neck (وی گلا)': '🔻',
  'Collar Neck (کالر گلا)': '👕',
  'Sherwani Collar (شیروانی گلا)': '🤵',
  'Chinese Collar (چینی گلا)': '👔',
  'Round Daman (گول دامن)': '🌙',
  'Square Daman (چوکور دامن)': '⬜',
  'Round Cut Daman (گول کٹ دامن)': '〰️',
  'Side Cut Daman (سائیڈ چاک)': '↔️',
  'Straight Daman (سیدھا دامن)': '➖',
  'Full Sleeve (پوری آستین)': '🧥',
  'Half Sleeve (آدھی آستین)': '👕',
  'Cuff Sleeve (کف آستین)': '🔘',
  'Loose Sleeve (کھلی آستین)': '〰️',
  'Straight Sleeve (سیدھی آستین)': '📏',
  'Slim Fit (چپکا فٹ)': '📏',
  'Regular Fit (نارمل فٹ)': '✅',
  'Loose Fit (کھلا فٹ)': '↔️',
  'Straight Bottom (سیدھا پائنچہ)': '➖',
  'Narrow Bottom (تنگ پائنچہ)': '📐',
  'Wide Bottom (کھلا پائنچہ)': '↔️',
  'Cuffed Bottom (موری والا پائنچہ)': '🔘',
  'Side Pocket (سائیڈ جیب)': '🧵',
  'Front Pocket (سامنے جیب)': '⬛',
  'Back Pocket (پیچھے جیب)': '↩️',
  'No Pocket (بغیر جیب)': '🚫',
  'Ankle Length (ٹخنے تک)': '🦶',
  'Full Length (پوری لمبائی)': '📏',
  'Short Length (چھوٹی لمبائی)': '↕️',
  'V Collar (وی گلا)': '🔻',
  'Round Collar (گول کالر)': '⭕',
  'Band Collar (بینڈ کالر)': '👔',
  'Shawl Collar (شال کالر)': '🧣',
  'Single Button Line (سنگل پٹی)': '🔘',
  'Double Button Line (ڈبل پٹی)': '🔘🔘',
  'Hidden Button Patti (چھپی پٹی)': '🙈',
  'Fancy Buttons (فینسی بٹن)': '✨',
  'Simple Cuff (سادہ کف)': '➖',
  'Round Cuff (گول کف)': '⭕',
  'Button Cuff (بٹن والا کف)': '🔘',
  'Open Sleeve (کھلی آستین)': '↔️',
  'Simple Button (سادہ بٹن)': '🔘',
  'Fancy Button (فینسی بٹن)': '✨',
  'Metal Button (دھاتی بٹن)': '⚙️',
  'Covered Button (کپڑے والا بٹن)': '🧵',
  'Double Button (ڈبل بٹن)': '🔘🔘',
  'Kaf Patti (کف پٹی)': '🔘',
  'Embroidery (کڑھائی)': '🌸',
  'Piping (پائپنگ)': '〰️',
  'Lace (لیس)': '🎀',
  'Lining (استر)': '🧥',
  'Chak Patti (چاک پٹی)': '↔️',
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
  const sections = selectedType ? measurementSections(selectedType, fields) : []
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
        supabase
          .from('measurements')
          .select('order_for_name,recipient_gender,taken_at')
          .eq('customer_id', data.customerId)
          .eq('order_for_relation', selectedRelation)
          .not('order_for_name', 'is', null)
          .is('deleted_at', null)
          .order('taken_at', { ascending: false }),
        supabase
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
        const sorted = [...byName.values()].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
        setKnownRecipients(sorted)
        const hasSelectedName = !!data.orderForName?.trim()
        if (!hasSelectedName && sorted[0]) {
          onUpdate({
            orderForName: sorted[0].name,
            recipientGender: sorted[0].gender ?? inferRecipientGender(selectedRelation, data.customerGender, data.recipientGender),
            measurementId: undefined,
            measurements: {},
            styleSelections: {},
          })
        }
      }
    }

    load().catch(console.error)
    return () => { cancelled = true }
  }, [data.customerId, selectedRelation, data.customerGender, data.orderForName, data.recipientGender, onUpdate])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!data.customerId || !selectedType) {
        setPreviousMeasurements([])
        return
      }
      const { data: rows, error } = await supabase
        .from('measurements')
        .select('id,customer_id,shop_id,garment_type,order_for_relation,order_for_name,recipient_gender,values,notes,taken_at,deleted_at')
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

  useEffect(() => {
    if (allowedRelations.includes(selectedRelation)) return
    updateRecipient('self')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.customerGender, selectedRelation])

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
          <div className="space-y-4">
            {sections.map(section => (
              <section key={section.title} className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{section.title}</p>
                    {section.helper && (
                      <p className="mt-0.5 text-[11px] text-slate-400">{section.helper}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                    {section.fields.filter(field => measurements[field.key]).length}/{section.fields.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                  {section.fields.map(({ key, label, unit }) => (
                    <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <label className="mb-1 block text-[11px] font-medium text-slate-500">
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
                          className="w-full flex-1 bg-transparent text-sm font-semibold text-slate-800
                                     outline-none disabled:text-slate-500"
                        />
                        <span className="shrink-0 text-[10px] text-slate-400">{unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
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
            <Image
              src={quickPhoto}
              alt="Fabric"
              width={400}
              height={160}
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
      <div className="fixed inset-x-0 bottom-[calc(2.5rem+env(safe-area-inset-bottom))] z-40 w-full bg-white border-t border-slate-100 px-4 py-2
                      lg:static lg:max-w-none lg:pb-2.5">
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
      <div className="h-25 lg:h-0" />
    </div>
  )
}

