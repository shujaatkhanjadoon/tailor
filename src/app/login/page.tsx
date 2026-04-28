// src/app/login/page.tsx - redirect old URL
import { redirect } from 'next/navigation'

export default function LoginRedirect() {
  redirect('/auth')
}
