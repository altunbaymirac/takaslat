import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase sorgu nesneleri tembeldir: then() çağrılmadan HTTP isteği çıkmaz.
// Görüntülenme sayacı bir dönem `void supabase.rpc(...)` ile çağrıldığı için
// hiç tetiklenmedi ve yeni ilanların hepsi "0 görüntülenme"de kaldı.
// Bu test, sahte istemcide then()'in gerçekten çağrıldığını doğrular.

// vi.mock dosyanın en üstüne taşındığı için paylaşılan sahteler vi.hoisted ile.
const { rpc, rpcThen, listingRow } = vi.hoisted(() => {
  const rpcThen = vi.fn();
  return {
    rpcThen,
    rpc: vi.fn(() => ({ then: rpcThen })),
    listingRow: {
      id: 'l1',
      owner_id: 'o1',
      title: 'Test ilanı',
      category: 'Araç',
      estimated_value: 100000,
      images: [],
      attachments: [],
      tags: [],
      is_active: true,
      moderation_status: 'approved',
    },
  };
});

function query(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'in', 'or', 'ilike', 'gte', 'lte']) {
    q[m] = () => q;
  }
  q.single = async () => ({ data: result, error: null });
  q.maybeSingle = async () => ({ data: result, error: null });
  return q;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => query(listingRow),
    rpc,
    auth: {
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => undefined,
  }),
}));

import { fetchListingById } from './api';

beforeEach(() => {
  rpc.mockClear();
  rpcThen.mockClear();
});

describe('ilan görüntüleme sayacı', () => {
  it('ilan açıldığında sayaç isteğini gerçekten tetikler', async () => {
    await fetchListingById('l1');

    expect(rpc).toHaveBeenCalledWith('increment_listing_view', { p_listing_id: 'l1' });
    // Asıl kontrol: sadece sorgu kurulmakla kalmamalı, then() ile yürütülmeli.
    expect(rpcThen).toHaveBeenCalledTimes(1);
  });
});
