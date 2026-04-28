// src/app/setup/page.tsx - redirect old URL
import { redirect } from 'next/navigation'

export default function SetupRedirect() {
  redirect('/auth')
}
