import { useQuery } from '@tanstack/react-query'
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

export function useProductsQuery({ siteSlug = 'default', categoryId, vegFilter = 'all', enabled }) {
  return useQuery({
    // if `enabled` is passed, use it; otherwise keep old behavior: !!categoryId
    enabled: typeof enabled === 'boolean' ? enabled : !!categoryId,
    queryKey: ['products', siteSlug, categoryId, vegFilter],
    queryFn: () => {
      const params = new URLSearchParams();

      // previous behavior: only add categoryId when we have one
      if (categoryId != null) {
        params.set('categoryId', String(categoryId));
      }

      if (vegFilter === 'veg') params.set('veg', 'veg');
      if (vegFilter === 'nonveg') params.set('veg', 'nonveg');

      const qs = params.toString();
      const url = qs
        ? `/api/shop/${siteSlug}/products?${qs}`
        : `/api/shop/${siteSlug}/products`;

      return fetchJson(url);
    },
  });
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

