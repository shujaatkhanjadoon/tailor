import { resolve as resolvePath, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { statSync } from 'node:fs'
import { register } from 'node:module'

register(
  `data:text/javascript,${encodeURIComponent(`
import { resolve as resolvePath, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { statSync } from 'node:fs'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const base = process.cwd()
    const relative = specifier.slice(2)
    let resolved = resolvePath(base, 'src', relative)
    // Add .ts extension if missing
    if (!/\.(ts|tsx|js|mjs)$/.test(resolved)) {
      resolved += '.ts'
    }
    // If the resolved file doesn't exist but the directory does, try index.ts
    try {
      statSync(resolved)
    } catch {
      const dir = resolved.endsWith('.ts') ? resolved.slice(0, -3) : resolved
      try {
        statSync(dir)
        resolved = resolvePath(dir, 'index.ts')
      } catch {
        // keep original, let nextResolve fail with a clear error
      }
    }
    return nextResolve(pathToFileURL(resolved).href)
  }
  // Node ESM requires explicit extensions; relative (./ ../) often omit .ts/.js
  // NOTE: double-backslash \\ because this code is inside a template literal
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\\.\\w+$/.test(specifier)) {
    try {
      return await nextResolve(specifier + '.ts', context)
    } catch {
      try { return await nextResolve(specifier + '.js', context) } catch { /* fall through */ }
    }
  }
  // next/* packages need explicit .js in ESM (no exports field in this version)
  if (specifier.startsWith('next/') && !specifier.endsWith('.js')) {
    try { return await nextResolve(specifier + '.js', context) } catch { /* fall through */ }
  }
  return await nextResolve(specifier, context)
}
  `)}`,
  { parentURL: pathToFileURL(process.cwd() + '/').href },
)
