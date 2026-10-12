import type { QueryClient } from '@tanstack/react-query'
import { api, ApiError, type User } from './api'

export async function currentUser(): Promise<User | null> {
  try {
    return await api<User>('auth/me/')
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || (error.status === 403 && error.code === 'not_authenticated'))) return null
    throw error
  }
}

export async function updateSession(client: QueryClient, user: User | null) {
  // Cancel old requests before they can overwrite the new session or its data.
  await client.cancelQueries()
  // Keep the mounted App observer attached to the same query instance.
  client.setQueryData(['me'], user)
  client.removeQueries({ predicate: query => !(query.queryKey.length === 1 && query.queryKey[0] === 'me') })
  client.getMutationCache().clear()
}
