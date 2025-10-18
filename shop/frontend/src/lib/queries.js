import { useQuery, useQueries } from '@tanstack/react-query'
import { fetchJson } from './api'

export function useSiteQuery(siteSlug = 'default') {
  return useQuery({
    queryKey: ['site', siteSlug],
    queryFn: () => fetchJson(`/api/shop/${siteSlug}/site`),
  })
}

export function useCategoriesQuery(siteSlug = 'default') {
  return useQuery({
    queryKey: ['categories', siteSlug],
    queryFn: () => fetchJson(`/api/shop/${siteSlug}/categories`),
  })
}

export function useProductsQuery({ siteSlug = 'default', categoryId, vegFilter = 'all' }) {
  return useQuery({
    enabled: !!categoryId,
    queryKey: ['products', siteSlug, categoryId, vegFilter],
    queryFn: () => {
      const params = new URLSearchParams({ categoryId: String(categoryId) })
      if (vegFilter === 'veg') params.set('veg', 'veg')
      if (vegFilter === 'nonveg') params.set('veg', 'nonveg')
      return fetchJson(`/api/shop/${siteSlug}/products?${params.toString()}`)
    },
  })
}

export function useLocationsQuery(siteSlug = 'default') {
  return useQuery({
    queryKey: ['locations', siteSlug],
    queryFn: () => fetchJson(`/api/shop/${siteSlug}/locations`),
  })
}

export function useCitiesQuery(siteSlug = 'default') {
  return useQuery({
    queryKey: ['cities', siteSlug],
    queryFn: () => fetchJson(`/api/shop/${siteSlug}/cities`),
  })
}

export function useHoursQuery(siteSlug = 'default') {
  return useQuery({
    queryKey: ['hours', siteSlug],
    queryFn: () => fetchJson(`/api/shop/${siteSlug}/hours`),
  })
}

export function useCategoryCountsQuery(siteSlug = 'default', categories) {
  const list = Array.isArray(categories) ? categories : []
  const results = useQueries({
    queries: list.map((c) => ({
      queryKey: ['productsCount', siteSlug, String(c._id)],
      queryFn: async () => {
        const data = await fetchJson(`/api/shop/${siteSlug}/products?categoryId=${encodeURIComponent(String(c._id))}`)
        return data.length
      },
      enabled: !!c?._id,
      staleTime: 60_000,
    })),
  })
  const counts = {}
  results.forEach((r, idx) => {
    const id = String(list[idx]._id)
    if (r.isSuccess) counts[id] = r.data
  })
  return counts
}
