import type { useAppStore } from '../store/useAppStore';

type Filters = ReturnType<typeof useAppStore.getState>['filters'];

/** Araçlara özel ayrıntılı alanlarda kaç seçim aktif? Filtre rozetinde kullanılır. */
export function advancedFilterCount(filters: Filters) {
  return (
    filters.fuels.length +
    (filters.minYear > 1990 ? 1 : 0) +
    (filters.maxYear < new Date().getFullYear() ? 1 : 0) +
    (filters.minKm > 0 ? 1 : 0) +
    (filters.maxKm < 500_000 ? 1 : 0) +
    (filters.noAccidentOnly ? 1 : 0)
  );
}
