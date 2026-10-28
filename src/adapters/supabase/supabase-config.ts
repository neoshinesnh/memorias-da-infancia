import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL_VARIABLE = 'SUPABASE_URL'
const SUPABASE_SECRET_KEY_VARIABLE = 'SUPABASE_SECRET_KEY'
const EMPTY_LENGTH = 0
const FETCH_CACHE_MODE = 'no-store'
const UNKNOWN_FAILURE_CODE = 'unknown'

export class MissingSupabaseConfigError extends Error {
  constructor() {
    super('SUPABASE_URL and SUPABASE_SECRET_KEY are required')
    this.name = 'MissingSupabaseConfigError'
  }
}

export class SessionStoreError extends Error {
  constructor(code: string) {
    super(`Session store failed (${code})`)
    this.name = 'SessionStoreError'
  }
}

export function createSupabaseClient(): SupabaseClient {
  return createClient(readSupabaseUrl(), readSupabaseSecretKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: createUncachedFetch(),
    },
  })
}

export function raiseStoreFailure(failure: { code?: string; message?: string }): never {
  throw new SessionStoreError(readFailureCode(failure.code))
}

function readSupabaseUrl(): string {
  return readRequiredSetting(SUPABASE_URL_VARIABLE)
}

function readSupabaseSecretKey(): string {
  return readRequiredSetting(SUPABASE_SECRET_KEY_VARIABLE)
}

function readRequiredSetting(name: string): string {
  const value = process.env[name]
  if (value === undefined) {
    throw new MissingSupabaseConfigError()
  }
  if (value.length === EMPTY_LENGTH) {
    throw new MissingSupabaseConfigError()
  }
  return value
}

function createUncachedFetch(): typeof fetch {
  return (input, init) => fetch(input, { ...init, cache: FETCH_CACHE_MODE })
}

function readFailureCode(code: string | undefined): string {
  if (code === undefined) {
    return UNKNOWN_FAILURE_CODE
  }
  if (code.length === EMPTY_LENGTH) {
    return UNKNOWN_FAILURE_CODE
  }
  return code
}
