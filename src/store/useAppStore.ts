import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Listing, SwapOffer, AIMessage, FilterState, ListingReport, Notification, SavedSearch, SwapRating, WishItem, MeetingProposal, ListingQA, LiveAuction, SwapProcess, SwapProcessStep } from '../types';
import {
  fetchListings,
  fetchOffers,
  fetchNotifications,
  fetchAuctions,
  createListing as apiCreateListing,
  updateListingApi,
  deleteListingApi,
  createAuctionApi,
  placeAuctionBidApi,
  closeAuctionApi,
  createOffer as apiCreateOffer,
  updateOfferStatus as apiUpdateOfferStatus,
  reviseOfferApi,
  createListingReport as apiCreateListingReport,
  sendMessage as apiSendMessage,
  markNotificationsReadApi,
  login       as apiLogin,
  register    as apiRegister,
  getMe,
  updateMe,
  setToken,
  removeToken,
  clearToken,
  supabase,
} from '../services/api';
import { trackProductEvent } from '../lib/analytics';
import { validateOfferDraft } from '../lib/offerValidation';

let authListenerReady = false;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id:      string;
  name:    string;
  email:   string;
  phone?:  string;
  avatar?: string;
  city?:   string;
  rating?: number;
  totalSwaps?: number;
  twoFactorEnabled?: boolean;
  role?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
}

interface AppState {
  // ── Data
  listings: Listing[];
  offers:   SwapOffer[];
  notifications: Notification[];
  auctions: LiveAuction[];
  auctionSyncState: 'idle' | 'loading' | 'live' | 'local' | 'error';

  // ── Auth
  token:       string | null;
  currentUser: AuthUser | null;

  // ── Backward-compat shortcuts (kept for components that use them)
  currentUserId:   string;
  currentUserName: string;

  // ── UI
  filters:          FilterState;
  aiPanelOpen:      boolean;
  aiPanelListingId: string | null;
  aiMessages:       AIMessage[];

  // ── Favoriler & Karanlık mod & Raporlar
  favorites:    string[];
  darkMode:     boolean;
  soundEnabled: boolean;
  accentColor:  string;       // tailwind color name: blue, emerald, violet, orange, pink, teal
  reports:      ListingReport[];

  // ── Karşılaştırma & Bildirimler
  compareList:               string[];   // max 3
  notificationsLastSeenAt:   string;     // ISO
  recentlyViewed:            string[];   // son görüntülenen ilan id'leri (max 12)
  searchHistory:             string[];   // son aramalar (max 10)

  // ── Boost & mute & analytics
  boostedListings:           Record<string, string>;  // listingId → boostedAt ISO
  mutedOffers:               string[];                // offer id'leri
  viewLog:                   Record<string, string[]>; // listingId → ISO timestamps[]
  qas:                       ListingQA[];             // public Q&A
  bundleCart:                string[];                // bundle teklif için seçili listing id'leri
  onboardingDone:            boolean;
  termsAccepted:             boolean;

  // ── Kaydedilmiş aramalar & ratings & wishlist & meetings
  savedSearches:             SavedSearch[];
  ratings:                   SwapRating[];
  wishlist:                  WishItem[];
  meetings:                  MeetingProposal[];
  conversationNotes:         Record<string, string>;
  swapProcesses:             Record<string, SwapProcess>;

  // ── Actions
  loadListings:  () => Promise<void>;
  loadOffers:    () => Promise<void>;
  loadNotifications: () => Promise<void>;
  loadAuctions:  () => Promise<void>;
  pushNotification:  (notification: Notification) => void;
  loginUser:     (email: string, password: string, twoFactorCode?: string) => Promise<void>;
  registerUser:  (name: string, email: string, password: string, city?: string) => Promise<void>;
  logoutUser:    () => void;
  initAuth:      () => Promise<void>;
  updateProfile: (patch: { name?: string; city?: string; avatar?: string; phone?: string }) => Promise<void>;

  addListing:        (listing: Omit<Listing, 'id' | 'createdAt' | 'ownerId' | 'ownerName' | 'ownerAvatar'>) => Promise<void>;
  updateListing:     (listingId: string, patch: Partial<Listing>) => void;
  deleteListing:     (listingId: string) => void;
  createAuction:     (auction: Omit<LiveAuction, 'id' | 'createdAt' | 'bids' | 'currentBid' | 'watcherCount'>) => Promise<string>;
  placeAuctionBid:   (auctionId: string, amount: number, note?: string) => Promise<void>;
  closeAuction:      (auctionId: string) => Promise<void>;

  sendOffer:         (offer: Omit<SwapOffer, 'id' | 'createdAt'>) => Promise<void>;
  updateOfferStatus: (offerId: string, status: SwapOffer['status']) => Promise<void>;
  reviseOffer:       (offerId: string, patch: { offeredValue?: number; offeredListingId?: string; offeredListingTitle?: string }) => Promise<void>;
  addOfferMessage:   (offerId: string, message: string, fromUserId: string) => void;
  setConversationNote: (offerId: string, note: string) => void;
  toggleSwapProcessStep: (offerId: string, step: SwapProcessStep) => void;

  toggleFavorite:  (listingId: string) => void;
  isFavorite:      (listingId: string) => boolean;

  toggleCompare:   (listingId: string) => void;
  clearCompare:    () => void;

  recordView:      (listingId: string) => void;
  clearRecentlyViewed: () => void;
  recordSearch:    (term: string) => void;
  clearSearchHistory: () => void;

  boostListing:    (listingId: string) => void;
  isBoosted:       (listingId: string) => boolean;
  toggleMuteOffer: (offerId: string) => void;
  isMuted:         (offerId: string) => boolean;

  // Q&A
  askQuestion:     (listingId: string, question: string) => void;
  answerQuestion:  (qaId: string, answer: string) => void;
  deleteQA:        (qaId: string) => void;

  // Bundle cart
  toggleBundleItem: (listingId: string) => void;
  clearBundle:      () => void;

  // Onboarding
  completeOnboarding: () => void;
  resetOnboarding:    () => void;
  acceptTerms:        () => void;

  markNotificationsRead: () => void;
  getNotifications:      () => Notification[];

  saveCurrentSearch:     (name: string) => void;
  deleteSavedSearch:     (id: string) => void;
  applySavedSearch:      (id: string) => void;

  addRating:             (rating: Omit<SwapRating, 'id' | 'createdAt'>) => void;
  getUserRating:         (userId: string) => { average: number; count: number };

  // Wishlist
  addWish:               (wish: Omit<WishItem, 'id' | 'createdAt' | 'matchedIds'>) => void;
  removeWish:            (id: string) => void;
  toggleWishNotify:      (id: string) => void;
  matchWish:             (wish: WishItem, listings: Listing[]) => Listing[];

  // Meeting
  addMeeting:            (meeting: Omit<MeetingProposal, 'id' | 'createdAt'>) => void;
  updateMeetingStatus:   (id: string, status: MeetingProposal['status']) => void;

  toggleDarkMode:  () => void;
  setDarkMode:     (on: boolean) => void;
  toggleSound:     () => void;
  setAccentColor:  (color: string) => void;
  addReport:       (listingId: string, reason: string, details?: string) => Promise<void>;

  setFilters:      (filters: Partial<FilterState>) => void;
  resetFilters:    () => void;
  openAIPanel:     (listingId?: string) => void;
  closeAIPanel:    () => void;
  addAIMessage:    (message: AIMessage) => void;
  clearAIMessages: () => void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultFilters: FilterState = {
  category:       'Araç',
  propertyKind:   '',
  city:           '',
  minValue:       0,
  maxValue:       5_000_000,
  searchQuery:    '',
  model:          '',
  brands:         [],
  minYear:        1990,
  maxYear:        new Date().getFullYear(),
  minKm:          0,
  maxKm:          500_000,
  fuels:          [],
  noAccidentOnly: false,
  vehicleGroup:   '',
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Initial state (boş — gerçek veri DB'den gelir)
      listings:                [],
      offers:                  [],
      notifications:           [],
      auctions:                [],
      auctionSyncState:        'idle',
      token:                   null,
      currentUser:             null,
      currentUserId:           '',
      currentUserName:         'Kullanıcı',
      filters:                 defaultFilters,
      aiPanelOpen:             false,
      aiPanelListingId:        null,
      aiMessages:              [],
      favorites:               [],
      darkMode:                false,
      soundEnabled:            true,
      accentColor:             'blue',
      reports:                 [],
      compareList:             [],
      notificationsLastSeenAt: new Date(0).toISOString(),
      recentlyViewed:          [],
      searchHistory:           [],
      boostedListings:         {},
      mutedOffers:             [],
      viewLog:                 {},
      qas:                     [],
      bundleCart:              [],
      onboardingDone:          false,
      termsAccepted:           false,
      savedSearches:           [],
      ratings:                 [],
      wishlist:                [],
      meetings:                [],
      conversationNotes:       {},
      swapProcesses:           {},

      // ── Load listings from API (or mock)
      loadListings: async () => {
        try {
          const listings = await fetchListings();
          set({ listings });
        } catch {
          set({ listings: [] });
        }
      },

      // ── Load offers (giriş yapılmışsa)
      loadOffers: async () => {
        const { token, currentUserId } = get();
        if (!token) {
          set({ offers: [] });
          return;
        }
        try {
          const offers = (await fetchOffers(currentUserId)) as SwapOffer[];
          set({ offers });
        } catch {
          set({ offers: [] });
        }
      },

      loadNotifications: async () => {
        if (!get().token) {
          set({ notifications: [] });
          return;
        }
        try {
          const notifications = await fetchNotifications();
          set({ notifications });
        } catch {
          set({ notifications: [] });
        }
      },

      loadAuctions: async () => {
        set({ auctionSyncState: 'loading' });
        try {
          const auctions = await fetchAuctions();
          set({ auctions, auctionSyncState: 'live' });
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          const schemaUnavailable = /auctions|auction_bids|schema cache|PGRST205/i.test(message);
          set({ auctionSyncState: schemaUnavailable ? 'local' : 'error' });
        }
      },

      pushNotification: (notification) =>
        set((s) => ({
          notifications: [notification, ...s.notifications.filter((n) => n.id !== notification.id)].slice(0, 50),
        })),

      // ── Auth: check stored token on startup
      initAuth: async () => {
        try {
          const syncSession = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
            if (!session) {
              removeToken();
              set({
                token: null,
                currentUser: null,
                currentUserId: '',
                currentUserName: 'Kullanıcı',
                offers: [],
                notifications: [],
              });
              return;
            }

            setToken(session.access_token);
            const user = await getMe() as AuthUser | null;
            if (!user) throw new Error('Kullanıcı profili yüklenemedi');

            set({
              token: session.access_token,
              currentUser: user,
              currentUserId: user.id,
              currentUserName: user.name,
            });
            const createdAt = Date.parse(session.user.created_at);
            const isNewOAuthUser = session.user.app_metadata.provider === 'google'
              && Number.isFinite(createdAt)
              && Date.now() - createdAt < 60_000;
            const signupKey = `takaslat-google-signup:${session.user.id}`;
            if (isNewOAuthUser && !sessionStorage.getItem(signupKey)) {
              sessionStorage.setItem(signupKey, '1');
              trackProductEvent('sign_up', { method: 'google' });
            }
            await Promise.all([get().loadListings(), get().loadOffers(), get().loadNotifications()]);
          };

          // OAuth dönüşünde SIGNED_IN, getSession çağrısından sonra gelebilir.
          // Listener her zaman kurulmalı ve callback içinde Supabase çağrısı bekletilmemeli.
          if (!authListenerReady) {
            supabase.auth.onAuthStateChange((event, newSession) => {
              if (!['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED'].includes(event)) return;
              window.setTimeout(() => {
                void syncSession(newSession).catch(() => {
                  removeToken();
                  set({ token: null, currentUser: null, currentUserId: '', currentUserName: 'Kullanıcı' });
                });
              }, 0);
            });
            authListenerReady = true;
          }

          const { data: { session } } = await supabase.auth.getSession();
          await syncSession(session);
          return;
        } catch {
          removeToken();
          set({ token: null, currentUser: null, currentUserId: '', currentUserName: 'Kullanıcı' });
        }
      },

      loginUser: async (email, password, twoFactorCode) => {
        const res = (await apiLogin(email, password, twoFactorCode) as unknown) as {
          user?: AuthUser;
          token?: string;
          requires2FA?: boolean;
          message?: string;
        };
        if (res.requires2FA || !res.token || !res.user) {
          throw new Error(res.message ?? 'Doğrulama kodu gerekli');
        }
        setToken(res.token);
        set({
          token:           res.token,
          currentUser:     res.user,
          currentUserId:   res.user.id,
          currentUserName: res.user.name,
        });
        await get().loadListings();
        await get().loadOffers();
        await get().loadNotifications();
      },

      registerUser: async (name, email, password, city) => {
        const res = (await apiRegister({ name, email, password, city }) as unknown) as { user: AuthUser; token: string };
        setToken(res.token);
        set({
          token:           res.token,
          currentUser:     res.user,
          currentUserId:   res.user.id,
          currentUserName: res.user.name,
        });
        await get().loadListings();
        await get().loadOffers();
        await get().loadNotifications();
      },

      updateProfile: async (patch) => {
        await updateMe(patch);
        set((state) => {
          if (!state.currentUser) return state;
          const updated = { ...state.currentUser, ...patch };
          return {
            currentUser: updated,
            currentUserId: updated.id,
            currentUserName: updated.name,
          };
        });
      },

      logoutUser: () => {
        clearToken(); // supabase.auth.signOut() burada çağrılıyor (clearToken içinde)
        set({
          token:           null,
          currentUser:     null,
          currentUserId:   '',
          currentUserName: 'Kullanıcı',
          offers:          [],
          listings:        [],
          notifications:   [],
        });
      },

      // ── Listing CRUD (optimistic; UI updates immediately)
      addListing: async (data) => {
        const { currentUser, currentUserId, currentUserName } = get();
        const draft: Omit<Listing, 'id' | 'createdAt'> = {
          ...data,
          ownerId:     currentUser?.id     ?? currentUserId,
          ownerName:   currentUser?.name   ?? currentUserName,
          ownerAvatar: currentUser?.avatar ?? 'https://picsum.photos/seed/me/100/100',
        };
        const newListing = await apiCreateListing(draft);
        set((s) => ({ listings: [newListing, ...s.listings] }));
      },

      updateListing: (listingId, patch) => {
        void updateListingApi(listingId, patch).catch(() => undefined);
        set((s) => ({
          listings: s.listings.map((l) => (l.id === listingId ? { ...l, ...patch } : l)),
        }));
      },

      deleteListing: (listingId) => {
        void deleteListingApi(listingId).catch(() => undefined);
        set((s) => ({
          listings:    s.listings.filter((l) => l.id !== listingId),
          favorites:   s.favorites.filter((id) => id !== listingId),
          compareList: s.compareList.filter((id) => id !== listingId),
          auctions:    s.auctions.filter((a) => a.listingId !== listingId),
        }));
      },

      // ── Offers
      createAuction: async (auction) => {
        const now = new Date().toISOString();
        const ownerId = get().currentUserId;
        const id = `auc-local-${Date.now()}`;
        const optimisticAuction: LiveAuction = {
          ...auction,
          id,
          ownerId,
          createdAt: now,
          currentBid: auction.startingPrice,
          bids: [],
          watcherCount: 0,
        };
        set((s) => ({
          auctions: [
            optimisticAuction,
            ...s.auctions.filter((a) => a.listingId !== auction.listingId),
          ],
        }));
        try {
          const created = await createAuctionApi({ ...auction, ownerId });
          set((s) => ({
            auctions: [created, ...s.auctions.filter((item) => item.id !== id && item.listingId !== created.listingId)],
            auctionSyncState: 'live',
          }));
          return created.id;
        } catch (error) {
          set((s) => ({ auctions: s.auctions.filter((item) => item.id !== id), auctionSyncState: 'error' }));
          throw error;
        }
      },

      placeAuctionBid: async (auctionId, amount, note) => {
        const { currentUserId, currentUserName } = get();
        const previous = get().auctions.find((auction) => auction.id === auctionId);
        if (!currentUserId) throw new Error('Teklif vermek için giriş yapmalısınız');
        if (previous?.ownerId === currentUserId) throw new Error('Kendi mezadınıza teklif veremezsiniz');
        set((s) => ({
          auctions: s.auctions.map((auction) => {
            const now = Date.now();
            const endsAt = new Date(auction.endsAt).getTime();
            const minimumBid = auction.currentBid + auction.bidIncrement;
            if (auction.id !== auctionId || auction.status === 'ended' || now >= endsAt || amount < minimumBid) {
              return auction;
            }
            return {
              ...auction,
              status: 'live',
              currentBid: amount,
              bids: [
                {
                  id: `bid-${Date.now()}`,
                  userId: currentUserId,
                  userName: currentUserName,
                  amount,
                  note,
                  createdAt: new Date().toISOString(),
                },
                ...auction.bids,
              ],
            };
          }),
        }));
        try {
          const updated = await placeAuctionBidApi(auctionId, amount, note);
          set((s) => ({
            auctions: s.auctions.map((auction) => auction.id === auctionId ? updated : auction),
            auctionSyncState: 'live',
          }));
        } catch (error) {
          if (previous) {
            set((s) => ({
              auctions: s.auctions.map((auction) => auction.id === auctionId ? previous : auction),
              auctionSyncState: 'error',
            }));
          }
          throw error;
        }
      },

      closeAuction: async (auctionId) => {
        const previous = get().auctions.find((auction) => auction.id === auctionId);
        set((s) => ({
          auctions: s.auctions.map((auction) =>
            auction.id === auctionId ? { ...auction, status: 'ended' } : auction
          ),
        }));
        try {
          const updated = await closeAuctionApi(auctionId);
          set((s) => ({
            auctions: s.auctions.map((auction) => auction.id === auctionId ? updated : auction),
            auctionSyncState: 'live',
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (/auctions|schema cache|PGRST205/i.test(message) || auctionId.startsWith('auc-local-')) {
            set({ auctionSyncState: 'local' });
            return;
          }
          if (previous) {
            set((s) => ({
              auctions: s.auctions.map((auction) => auction.id === auctionId ? previous : auction),
              auctionSyncState: 'error',
            }));
          }
          throw error;
        }
      },

      sendOffer: async (data) => {
        const state = get();
        const targetListing = state.listings.find((listing) => listing.id === data.listingId);
        const offeredListing = data.offeredListingId
          ? state.listings.find((listing) => listing.id === data.offeredListingId)
          : undefined;
        const validationError = validateOfferDraft({
          actorId: state.currentUserId,
          targetOwnerId: targetListing?.ownerId ?? data.toUserId,
          targetListingId: data.listingId,
          offeredListingId: data.offeredListingId,
          message: data.message,
          offeredValue: data.offeredValue,
        });
        if (validationError) throw new Error(validationError);
        if (data.offeredListingId && (!offeredListing || offeredListing.ownerId !== state.currentUserId)) {
          throw new Error('Yalnızca kendi aktif ilanınızı teklif edebilirsiniz');
        }
        const created = await apiCreateOffer(data);
        set((s) => ({ offers: [created, ...s.offers.filter((o) => o.id !== created.id)] }));
      },

      updateOfferStatus: async (offerId, status) => {
        const updated = await apiUpdateOfferStatus(offerId, status);
        set((s) => ({ offers: s.offers.map((o) => (o.id === offerId ? updated : o)) }));
      },

      reviseOffer: async (offerId, patch) => {
        const state = get();
        const offer = state.offers.find((item) => item.id === offerId);
        if (!offer || offer.fromUserId !== state.currentUserId) {
          throw new Error('Yalnızca teklifi gönderen kişi teklifi revize edebilir');
        }
        if (patch.offeredListingId) {
          const offeredListing = state.listings.find((listing) => listing.id === patch.offeredListingId);
          if (!offeredListing || offeredListing.ownerId !== state.currentUserId || offeredListing.id === offer.listingId) {
            throw new Error('Yalnızca kendi aktif ilanınızı teklif edebilirsiniz');
          }
        }
        const updated = await reviseOfferApi(offerId, patch);
        set((s) => ({ offers: s.offers.map((o) => (o.id === offerId ? updated : o)) }));
      },

      addOfferMessage: (offerId, message, fromUserId) => {
        void apiSendMessage(offerId, message).then(() => get().loadOffers()).catch(() => undefined);
        set((s) => ({
          offers: s.offers.map((o) =>
            o.id === offerId
              ? {
                  ...o,
                  messages: [
                    ...(o.messages ?? []),
                    {
                      id:        `msg-${Date.now()}`,
                      fromUserId,
                      text:      message,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : o
          ),
        }));
      },

      setConversationNote: (offerId, note) =>
        set((s) => ({
          conversationNotes: {
            ...s.conversationNotes,
            [offerId]: note,
          },
        })),

      toggleSwapProcessStep: (offerId, step) =>
        set((s) => {
          const current = s.swapProcesses[offerId];
          const completedSteps = current?.completedSteps ?? [];
          const hasStep = completedSteps.includes(step);
          return {
            swapProcesses: {
              ...s.swapProcesses,
              [offerId]: {
                offerId,
                completedSteps: hasStep
                  ? completedSteps.filter((item) => item !== step)
                  : [...completedSteps, step],
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      // ── Favoriler
      toggleFavorite: (listingId) =>
        set((s) => ({
          favorites: s.favorites.includes(listingId)
            ? s.favorites.filter((id) => id !== listingId)
            : [listingId, ...s.favorites],
        })),
      isFavorite: (listingId) => get().favorites.includes(listingId),

      // ── Karşılaştırma (max 3)
      toggleCompare: (listingId) =>
        set((s) => {
          if (s.compareList.includes(listingId)) {
            return { compareList: s.compareList.filter((id) => id !== listingId) };
          }
          if (s.compareList.length >= 3) {
            // En eskini at, yenisini ekle
            return { compareList: [...s.compareList.slice(1), listingId] };
          }
          return { compareList: [...s.compareList, listingId] };
        }),
      clearCompare: () => set({ compareList: [] }),

      // ── Son görüntülenen (dedupe + max 12) + viewLog (max 100/listing)
      recordView: (listingId) =>
        set((s) => {
          const now = new Date().toISOString();
          const prevLog = s.viewLog[listingId] ?? [];
          return {
            recentlyViewed: [listingId, ...s.recentlyViewed.filter((id) => id !== listingId)].slice(0, 12),
            viewLog: {
              ...s.viewLog,
              [listingId]: [now, ...prevLog].slice(0, 100),
            },
          };
        }),
      clearRecentlyViewed: () => set({ recentlyViewed: [] }),

      // ── Arama geçmişi (dedupe, son 10)
      recordSearch: (term) => {
        const t = term.trim();
        if (t.length < 2) return;
        set((s) => ({
          searchHistory: [t, ...s.searchHistory.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 10),
        }));
      },
      clearSearchHistory: () => set({ searchHistory: [] }),

      // ── İlan Boost
      boostListing: (listingId) =>
        set((s) => ({
          boostedListings: { ...s.boostedListings, [listingId]: new Date().toISOString() },
        })),
      isBoosted: (listingId) => {
        const ts = get().boostedListings[listingId];
        if (!ts) return false;
        // 7 gün geçerli
        return Date.now() - new Date(ts).getTime() < 7 * 86_400_000;
      },

      // ── Sohbet Sessize Al
      toggleMuteOffer: (offerId) =>
        set((s) => ({
          mutedOffers: s.mutedOffers.includes(offerId)
            ? s.mutedOffers.filter((id) => id !== offerId)
            : [offerId, ...s.mutedOffers],
        })),
      isMuted: (offerId) => get().mutedOffers.includes(offerId),

      // ── Q&A
      askQuestion: (listingId, question) => {
        const { currentUserId, currentUserName } = get();
        set((s) => ({
          qas: [{
            id:        `qa-${Date.now()}`,
            listingId,
            userId:    currentUserId,
            userName:  currentUserName,
            question,
            createdAt: new Date().toISOString(),
          }, ...s.qas],
        }));
      },
      answerQuestion: (qaId, answer) =>
        set((s) => ({
          qas: s.qas.map((q) => q.id === qaId
            ? { ...q, answer, answeredAt: new Date().toISOString() }
            : q),
        })),
      deleteQA: (qaId) =>
        set((s) => ({ qas: s.qas.filter((q) => q.id !== qaId) })),

      // ── Bundle cart
      toggleBundleItem: (listingId) =>
        set((s) => ({
          bundleCart: s.bundleCart.includes(listingId)
            ? s.bundleCart.filter((id) => id !== listingId)
            : [...s.bundleCart, listingId],
        })),
      clearBundle: () => set({ bundleCart: [] }),

      // ── Onboarding
      completeOnboarding: () => set({ onboardingDone: true }),
      resetOnboarding:    () => set({ onboardingDone: false }),

      // ── Terms
      acceptTerms: () => set({ termsAccepted: true }),

      // ── Bildirimler (turevsel — offers'tan hesaplanir)
      getNotifications: () => {
        const { offers, currentUserId, mutedOffers, notifications } = get();
        const notes: Notification[] = [...notifications];

        for (const o of offers) {
          // Sessize alınan sohbetler bildirim üretmez
          if (mutedOffers.includes(o.id)) continue;
          // Gelen teklif
          if (o.toUserId === currentUserId && o.status === 'Beklemede') {
            notes.push({
              id:        `note-offer-${o.id}`,
              type:      'offer',
              title:     'Yeni teklif aldınız',
              body:      `${o.fromUserName} → ${o.listingTitle}`,
              href:      '/conversations',
              createdAt: o.createdAt,
              read:      o.createdAt <= get().notificationsLastSeenAt,
            });
          }
          // Statu degisikligi
          if (o.fromUserId === currentUserId && (o.status === 'Tamamlandı' || o.status === 'Reddedildi')) {
            notes.push({
              id:        `note-status-${o.id}`,
              type:      'status',
              title:     o.status === 'Tamamlandı' ? '✅ Teklifiniz kabul edildi' : '✕ Teklifiniz reddedildi',
              body:      o.listingTitle,
              href:      '/conversations',
              createdAt: o.createdAt,
              read:      o.createdAt <= get().notificationsLastSeenAt,
            });
          }
          // Yeni mesaj
          const lastMsg = o.messages?.[o.messages.length - 1];
          if (lastMsg && lastMsg.fromUserId !== currentUserId && (o.fromUserId === currentUserId || o.toUserId === currentUserId)) {
            notes.push({
              id:        `note-msg-${lastMsg.id}`,
              type:      'message',
              title:     'Yeni mesaj',
              body:      lastMsg.text.length > 40 ? lastMsg.text.slice(0, 40) + '…' : lastMsg.text,
              href:      '/conversations',
              createdAt: lastMsg.createdAt,
              read:      lastMsg.createdAt <= get().notificationsLastSeenAt,
            });
          }
        }

        return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
      },

      markNotificationsRead: () => {
        void markNotificationsReadApi().catch(() => undefined);
        set((s) => ({
          notificationsLastSeenAt: new Date().toISOString(),
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        }));
      },

      // ── Kaydedilmiş aramalar
      saveCurrentSearch: (name) => {
        const { filters } = get();
        set((s) => ({
          savedSearches: [
            {
              id:        `search-${Date.now()}`,
              name,
              filters:   { ...filters },
              createdAt: new Date().toISOString(),
            },
            ...s.savedSearches,
          ],
        }));
      },
      deleteSavedSearch: (id) =>
        set((s) => ({ savedSearches: s.savedSearches.filter((x) => x.id !== id) })),
      applySavedSearch: (id) => {
        const ss = get().savedSearches.find((x) => x.id === id);
        if (ss) set({ filters: { ...ss.filters } });
      },

      // ── Ratings
      addRating: (data) =>
        set((s) => ({
          ratings: [
            { ...data, id: `rat-${Date.now()}`, createdAt: new Date().toISOString() },
            ...s.ratings,
          ],
        })),
      getUserRating: (userId) => {
        const list = get().ratings.filter((r) => r.toUserId === userId);
        if (list.length === 0) return { average: 5, count: 0 };
        const sum = list.reduce((s, r) => s + r.stars, 0);
        return { average: sum / list.length, count: list.length };
      },

      // ── Wishlist
      addWish: (data) =>
        set((s) => ({
          wishlist: [
            { ...data, id: `wish-${Date.now()}`, createdAt: new Date().toISOString(), matchedIds: [] },
            ...s.wishlist,
          ],
        })),
      removeWish: (id) =>
        set((s) => ({ wishlist: s.wishlist.filter((w) => w.id !== id) })),
      toggleWishNotify: (id) =>
        set((s) => ({
          wishlist: s.wishlist.map((w) => (w.id === id ? { ...w, notify: !w.notify } : w)),
        })),
      // ── Meeting
      addMeeting: (data) =>
        set((s) => ({
          meetings: [
            { ...data, id: `meet-${Date.now()}`, createdAt: new Date().toISOString() },
            ...s.meetings,
          ],
        })),
      updateMeetingStatus: (id, status) =>
        set((s) => ({ meetings: s.meetings.map((m) => (m.id === id ? { ...m, status } : m)) })),

      matchWish: (wish, listings) => {
        return listings.filter((l) => {
          if (wish.category && l.category !== wish.category)              return false;
          if (wish.city     && !l.city.toLowerCase().includes(wish.city.toLowerCase())) return false;
          if (wish.maxValue && l.estimatedValue > wish.maxValue)          return false;
          const v = l.vehicleDetails;
          if (wish.brand && (!v?.brand || !v.brand.toLowerCase().includes(wish.brand.toLowerCase()))) return false;
          if (wish.model && (!v?.model || !v.model.toLowerCase().includes(wish.model.toLowerCase()))) return false;
          if (wish.minYear && v?.year !== undefined && v.year < wish.minYear) return false;
          if (wish.maxYear && v?.year !== undefined && v.year > wish.maxYear) return false;
          return true;
        });
      },

      // ── Karanlık mod
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      setDarkMode:    (on) => set({ darkMode: on }),

      // ── Ses & Tema
      toggleSound:    () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      setAccentColor: (color) => set({ accentColor: color }),

      // ── Rapor
      addReport: async (listingId, reason, details) => {
        const { currentUserId, listings } = get();
        if (!currentUserId) throw new Error('Şikayet için giriş yapmalısınız');
        const listing = listings.find((item) => item.id === listingId);
        if (listing?.ownerId === currentUserId) throw new Error('Kendi ilanınızı şikayet edemezsiniz');
        const report = await apiCreateListingReport(listingId, reason, details);
        set((s) => ({ reports: [report, ...s.reports.filter((item) => item.id !== report.id)] }));
      },

      setFilters:      (f)   => set((s) => ({ filters: { ...s.filters, ...f } })),
      resetFilters:    ()    => set({ filters: defaultFilters }),
      openAIPanel:     (id)  => set({ aiPanelOpen: true, aiPanelListingId: id ?? null }),
      closeAIPanel:    ()    => set({ aiPanelOpen: false }),
      addAIMessage:    (msg) => set((s) => ({ aiMessages: [...s.aiMessages, msg] })),
      clearAIMessages: ()    => set({ aiMessages: [] }),
    }),

    {
      name: 'takaslat-v8',
      partialize: (s) => ({
        token:                    s.token,
        currentUser:              s.currentUser,
        favorites:                s.favorites,
        darkMode:                 s.darkMode,
        soundEnabled:             s.soundEnabled,
        accentColor:              s.accentColor,
        reports:                  s.reports,
        auctions:                 s.auctions,
        compareList:              s.compareList,
        notificationsLastSeenAt:  s.notificationsLastSeenAt,
        savedSearches:            s.savedSearches,
        ratings:                  s.ratings,
        wishlist:                 s.wishlist,
        meetings:                 s.meetings,
        conversationNotes:        s.conversationNotes,
        swapProcesses:            s.swapProcesses,
        recentlyViewed:           s.recentlyViewed,
        searchHistory:            s.searchHistory,
        boostedListings:          s.boostedListings,
        mutedOffers:              s.mutedOffers,
        viewLog:                  s.viewLog,
        qas:                      s.qas,
        bundleCart:               s.bundleCart,
        onboardingDone:           s.onboardingDone,
        termsAccepted:            s.termsAccepted,
      }),
      merge: (persisted: unknown, current) => {
        const p = persisted as {
          token?:                   string | null;
          currentUser?:             AuthUser | null;
          favorites?:               string[];
          darkMode?:                boolean;
          soundEnabled?:            boolean;
          accentColor?:             string;
          reports?:                 ListingReport[];
          auctions?:                LiveAuction[];
          compareList?:             string[];
          notificationsLastSeenAt?: string;
          savedSearches?:           SavedSearch[];
          ratings?:                 SwapRating[];
          wishlist?:                WishItem[];
          meetings?:                MeetingProposal[];
          conversationNotes?:       Record<string, string>;
          swapProcesses?:           Record<string, SwapProcess>;
          recentlyViewed?:          string[];
          searchHistory?:           string[];
          boostedListings?:         Record<string, string>;
          mutedOffers?:             string[];
          viewLog?:                 Record<string, string[]>;
          qas?:                     ListingQA[];
          bundleCart?:              string[];
          onboardingDone?:          boolean;
          termsAccepted?:           boolean;
        } | null;

        const user = p?.currentUser ?? null;
        return {
          ...current,
          token:                   p?.token        ?? null,
          currentUser:             user,
          currentUserId:           user?.id ?? '',
          currentUserName:         user?.name      ?? 'Kullanıcı',
          favorites:               p?.favorites    ?? [],
          darkMode:                p?.darkMode     ?? false,
          soundEnabled:            p?.soundEnabled ?? true,
          accentColor:             p?.accentColor  ?? 'blue',
          reports:                 p?.reports      ?? [],
          auctions:                (p?.auctions ?? []).filter((auction) => !auction.id.startsWith('auc-seed-')),
          compareList:             p?.compareList  ?? [],
          notificationsLastSeenAt: p?.notificationsLastSeenAt ?? new Date(0).toISOString(),
          savedSearches:           p?.savedSearches ?? [],
          ratings:                 p?.ratings       ?? [],
          wishlist:                p?.wishlist      ?? [],
          meetings:                p?.meetings      ?? [],
          conversationNotes:       p?.conversationNotes ?? {},
          swapProcesses:           p?.swapProcesses ?? {},
          recentlyViewed:          p?.recentlyViewed ?? [],
          searchHistory:           p?.searchHistory  ?? [],
          boostedListings:         p?.boostedListings ?? {},
          mutedOffers:             p?.mutedOffers     ?? [],
          viewLog:                 p?.viewLog         ?? {},
          qas:                     p?.qas             ?? [],
          bundleCart:              p?.bundleCart      ?? [],
          onboardingDone:          p?.onboardingDone  ?? false,
          termsAccepted:           p?.termsAccepted   ?? false,
          // listings ve offers SADECE API'den gelir — persist edilmez
          listings:                [],
          offers:                  [],
        };
      },
    }
  )
);
