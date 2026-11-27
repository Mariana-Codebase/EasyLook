import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api, unwrap, type Outfit, type OutfitItemsResult, type OutfitSummary } from './client'

export function useOccasions() {
  return useQuery({
    queryKey: ['occasions'],
    queryFn: async () => (await unwrap(api.GET('/occasions'))).data,
    staleTime: 5 * 60_000,
  })
}

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: async () => (await unwrap(api.GET('/stores', { params: { query: { limit: 100 } } }))).data,
    staleTime: 5 * 60_000,
  })
}

export function useMyOutfits(status?: 'draft' | 'saved') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['outfits', status ?? 'all'],
    queryFn: () => unwrap(api.GET('/outfits', { params: { query: { limit: 100, ...(status && { status }) } } })),
    enabled: user !== null,
  })
}

export function useOutfit(outfitId: string | undefined) {
  return useQuery({
    queryKey: ['outfit', outfitId],
    queryFn: () => unwrap(api.GET('/outfits/{outfitId}', { params: { path: { outfitId: outfitId! } } })),
    enabled: Boolean(outfitId),
  })
}

/** Keeps every cached view of an outfit in sync after it changes. */
export function useOutfitCache() {
  const queryClient = useQueryClient()
  return {
    put(outfit: Outfit) {
      queryClient.setQueryData(['outfit', outfit.id], outfit)
      void queryClient.invalidateQueries({ queryKey: ['outfits'] })
    },
    refresh(outfitId: string) {
      void queryClient.invalidateQueries({ queryKey: ['outfit', outfitId] })
      void queryClient.invalidateQueries({ queryKey: ['outfits'] })
    },
    drop(outfitId: string) {
      queryClient.removeQueries({ queryKey: ['outfit', outfitId] })
      void queryClient.invalidateQueries({ queryKey: ['outfits'] })
    },
  }
}

export function useAddItem() {
  const cache = useOutfitCache()
  return useMutation({
    mutationFn: ({ outfitId, garmentId }: { outfitId: string; garmentId: string }) =>
      unwrap(api.POST('/outfits/{outfitId}/items', { params: { path: { outfitId } }, body: { garmentId } })),
    onSuccess: (result: OutfitItemsResult) => cache.refresh(result.outfitId),
  })
}

export function useRemoveItem() {
  const cache = useOutfitCache()
  return useMutation({
    mutationFn: ({ outfitId, garmentId }: { outfitId: string; garmentId: string }) =>
      unwrap(api.DELETE('/outfits/{outfitId}/items/{garmentId}', { params: { path: { outfitId, garmentId } } })),
    onSuccess: (result: OutfitItemsResult) => cache.refresh(result.outfitId),
  })
}

const ACTIVE_KEY = 'easylook.activeOutfit'

/** The draft the shop adds garments to, remembered between visits. */
export function useActiveOutfit() {
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(ACTIVE_KEY))
  const drafts = useMyOutfits('draft')
  const list = drafts.data?.data ?? []
  const active: OutfitSummary | null = list.find((o) => o.id === activeId) ?? list[0] ?? null

  return {
    drafts: list,
    active,
    choose(id: string) {
      localStorage.setItem(ACTIVE_KEY, id)
      setActiveId(id)
    },
  }
}
