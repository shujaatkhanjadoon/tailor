// src/app/setup/page.tsx — redirect old URL
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function SetupRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/auth') }, [])
  return null
}