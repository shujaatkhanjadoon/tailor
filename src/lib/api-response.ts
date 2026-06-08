import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export interface ApiSuccess<T = unknown> {
  success: true
  data?: T
}

export interface ApiError {
  success: false
  error: string
  code?: string
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError

export function ok<T>(data?: T, status = 200) {
  return NextResponse.json({ success: true, data } satisfies ApiSuccess<T>, { status })
}

export function created<T>(data?: T) {
  return NextResponse.json({ success: true, data } satisfies ApiSuccess<T>, { status: 201 })
}

export function badRequest(error: string) {
  return NextResponse.json({ success: false, error } satisfies ApiError, { status: 400 })
}

export function unauthorized(error = 'Unauthorized') {
  return NextResponse.json({ success: false, error } satisfies ApiError, { status: 401 })
}

export function forbidden(error = 'Forbidden') {
  return NextResponse.json({ success: false, error } satisfies ApiError, { status: 403 })
}

export function notFound(error = 'Not found') {
  return NextResponse.json({ success: false, error } satisfies ApiError, { status: 404 })
}

export function tooMany(error = 'Too many requests') {
  return NextResponse.json({ success: false, error } satisfies ApiError, { status: 429 })
}

export function serverError(error: unknown = 'Internal server error') {
  if (error instanceof Error) {
    Sentry.captureException(error)
    console.error('[API Error]', error)
    return NextResponse.json({ success: false, error: error.message } satisfies ApiError, { status: 500 })
  }
  if (typeof error === 'string') {
    Sentry.captureMessage(error)
    console.error('[API Error]', error)
    return NextResponse.json({ success: false, error } satisfies ApiError, { status: 500 })
  }
  console.error('[API Error]', error)
  return NextResponse.json({ success: false, error: 'Internal server error' } satisfies ApiError, { status: 500 })
}
