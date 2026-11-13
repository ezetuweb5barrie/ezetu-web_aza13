import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/app-context';
import { useSpots, fetchPhotos, fetchPhotosByAuthor, fetchPhotoAwards } from '@/lib/data';
import { supabase, getDeviceId } from '@/lib/supabase';
import { basqueName, getLocalizedCountry } from '@/lib/utils';
import { computeXp, levelProgress, mergeEarnedTiers, type RetoId } from '@/lib/passport-progress';
import { buildConquest } from '@/lib/passport-conquest';
import { PASSPORT_OWNER } from '@/lib/passport-social';
import { createPassportT, toPassportLang } from '@/lib/passport-strings';
import { loadPioneerSpotIds } from '@/lib/pioneer-spots';
import type { Photo, PhotoAward, Spot } from '@/lib/types';
import { PassportMapPanel } from './PassportMapPanel';
import { IdentityBlock } from './passport/IdentityBlock';
import { ConquestBlock } from './passport/ConquestBlock';
import { RetoBadgesBlock } from './passport/RetoBadgesBlock';
import { PortfolioBlock } from './passport/PortfolioBlock';
import { VisitedRankingBlock, type RankedSpotItem } from './passport/VisitedRankingBlock';

// Pre-seeded demo visits shown when the user has none of their own yet.
const SEED_VISIT_IDS = [
  '11111111-1111-4111-8111-111111111101',
  '11111111-1111-4111-8111-111111111102',
  '11111111-1111-4111-8111-111111111103',
  '11111111-1111-4111-8111-111111111108',
];

type OwnedPhoto = Photo & { spot?: Spot };

const ACTIVITY_I18N = {
  tabs: {
    photos: { es: 'Mis Fotos', eu: 'Nire Argazkiak', en: 'My Photos' },
    likes: { es: 'Mis Likes', eu: 'Nire Gustukoak', en: 'My Likes' },
    reviews: { es: 'Mis Valoraciones', eu: 'Nire Balorazioak', en: 'My Reviews' },
  },
  empty: {
    photos: {
      es: 'Aún no has subido ninguna foto. Pulsa "+ Aportar" para compartir tu primera captura.',
      eu: 'Oraindik ez duzu argazkirik igo. Egin klik "+ Gehitu" botoian zure lehen argazkia partekatzeko.',
      en: "You haven't uploaded any photos yet. Click '+ Add' to share your first shot.",
    },
    likes: {
      es: 'Aún no has dado like a ninguna foto. Explora la galería y guarda tus favoritas pulsando en el corazón ❤️.',
      eu: 'Oraindik ez diozu like eman inongo argazkiri. Arakatu galeria eta gorde zure gogokoenak bihotzean klik eginez ❤️.',
      en: "You haven't liked any photos yet. Explore the gallery and save your favorites by clicking the heart ❤️.",
    },
    reviews: {
      es: 'Aún no has valorado ningún lugar. Explora el mapa para puntuar un rincón y dejar tu consejo.',
      eu: 'Oraindik ez duzu lekurik baloratu. Arakatu mapa toki bat baloratu eta zure aholkua uzteko.',
      en: "You haven't reviewed any spots yet. Explore the map to rate a place and leave your tip.",
    },
  },
  viewOnMap: { es: 'Ver en el mapa', eu: 'Ikusi mapan', en: 'View on map' },
  noTip: { es: 'Sin consejo escrito', eu: 'Aholkurik gabe', en: 'No tip written' },
} as const;

type ActivityTab = 'photos' | 'likes' | 'reviews';
type ActivityLang = keyof (typeof ACTIVITY_I18N)['tabs']['photos'];

interface ReviewedSpot {
  spotId: string;
  spotName: string;
  province: string;
  image?: string;
  overall: number;
  tip?: string;
  date: string;
}

export function PassportView({ refreshKey }: { refreshKey?: number }) {
  const { lang, setTab, setFocusedSpotId, setMapLayer, visitedSpotIds, openLightbox, setPhotographerOpen,
    likedPhotoIds, userReviews, userPhotos: ctxUserPhotos, userTips } = useApp();
  const { spots } = useSpots(refreshKey);
  const passLang = toPassportLang(lang);
  const t = useMemo(() => createPassportT(passLang), [passLang]);
  const actLang: ActivityLang = lang === 'EUS' ? 'eu' : lang === 'EN' ? 'en' : 'es';

  const [fetchedPhotos, setFetchedPhotos] = useState<OwnedPhoto[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [awards, setAwards] = useState<PhotoAward[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [remoteLikedPhotos, setRemoteLikedPhotos] = useState<OwnedPhoto[]>([]);
  const [pioneerIds] = useState<string[]>(() => loadPioneerSpotIds());
  const [activityTab, setActivityTab] = useState<ActivityTab>('photos');
  const [visibleCount, setVisibleCount] = useState(6);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPhotosByAuthor(PASSPORT_OWNER.name), fetchPhotoAwards(), fetchPhotos()])
      .then(([photos, allAwards, everyPhoto]) => {
        if (cancelled) return;
        setFetchedPhotos(photos);
        setAllPhotos(everyPhoto);
        const owner = PASSPORT_OWNER.name.toLowerCase();
        setAwards(allAwards.filter((a) => a.authorId.toLowerCase() === owner));
      })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const did = getDeviceId();
    (async () => {
      try {
        const likesRes = await supabase.from('photo_likes').select('photos(*)').eq('device_id', did);
        if (cancelled) return;
        const liked = (likesRes.data ?? []).flatMap((r) => {
          const p = (r as { photos: Photo | Photo[] | null }).photos;
          return p ? [Array.isArray(p) ? p[0] : p] : [];
        }).filter(Boolean) as Photo[];
        setRemoteLikedPhotos(liked);
      } catch { /* offline — local state still shows */ }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const ownPhotos = useMemo<OwnedPhoto[]>(() => {
    const local = ctxUserPhotos.map((p) => ({ ...p, spot: spots.find((s) => s.id === p.spot_id) }));
    const seen = new Set(local.map((p) => p.id));
    return [...local, ...fetchedPhotos.filter((p) => !seen.has(p.id))];
  }, [ctxUserPhotos, fetchedPhotos, spots]);

  const likedPhotos = useMemo<OwnedPhoto[]>(() => {
    const pool = [...allPhotos, ...remoteLikedPhotos];
    const seen = new Set<string>();
    const result: OwnedPhoto[] = [];
    for (const id of likedPhotoIds.map(String)) {
      const p = pool.find((cand) => String(cand.id) === id);
      if (p && !seen.has(String(p.id))) {
        seen.add(String(p.id));
        result.push({ ...p, spot: spots.find((s) => s.id === p.spot_id) });
      }
    }
    for (const p of remoteLikedPhotos) {
      if (!seen.has(String(p.id))) {
        seen.add(String(p.id));
        result.push({ ...p, spot: spots.find((s) => s.id === p.spot_id) });
      }
    }
    return result;
  }, [likedPhotoIds, remoteLikedPhotos, allPhotos, spots]);

  const visitedIds = useMemo(() => {
    if (visitedSpotIds.size > 0) return visitedSpotIds;
    return new Set(SEED_VISIT_IDS);
  }, [visitedSpotIds]);

  const rankedSpots = useMemo(
    () => [...spots].sort((a, b) => b.bayesian_rating - a.bayesian_rating),
    [spots],
  );

  const ranked: RankedSpotItem[] = useMemo(() => rankedSpots
    .map((spot, i) => ({ spot, rank: i + 1 }))
    .filter(({ spot }) => visitedIds.has(spot.id))
    .map(({ spot, rank }) => ({
      spot,
      rank,
      name: lang === 'EUS' && spot.euskal_herria ? basqueName(spot.id, spot.name) : spot.name,
      place: spot.province ?? getLocalizedCountry(spot, lang).name,
    })), [rankedSpots, visitedIds, lang]);

  const visitedSpots = useMemo(() => ranked.map((r) => r.spot), [ranked]);

  const conquest = useMemo(() => buildConquest(passLang, visitedSpots), [passLang, visitedSpots]);

  const summitsVisited = visitedSpots.filter((s) => s.category === 'nature' && (s.elevation_m ?? 0) > 1500).length;
  const covesVisited = visitedSpots.filter((s) => s.category === 'nature' && (s.elevation_m ?? 0) < 500).length;
  const villagesVisited = visitedSpots.filter((s) => s.category === 'village').length;
  const pioneerCount = pioneerIds.length;
  const totalLikes = useMemo(() => ownPhotos.reduce((sum, p) => sum + p.likes, 0), [ownPhotos]);

  const likedWithSpots = likedPhotos;

  const reviewedSpots = useMemo<ReviewedSpot[]>(() => Object.values(userReviews)
    .map((r) => ({ ...r, tip: userTips.find((tip) => tip.spot_id === r.spotId)?.content }))
    .sort((a, b) => b.date.localeCompare(a.date)), [userReviews, userTips]);

  const xp = computeXp({
    visits: visitedIds.size,
    reviews: 0,
    photos: ownPhotos.length,
    photoLikes: totalLikes,
    pioneerSpots: pioneerCount,
  });
  const progress = levelProgress(xp);

  const retoValues: Record<RetoId, number> = {
    cabra: summitsVisited,
    alma: villagesVisited,
    calas: covesVisited,
    pionero: pioneerCount,
    ojo: totalLikes,
    trotamundos: conquest.countriesVisited,
  };
  const retoTiers = mergeEarnedTiers(retoValues);

  const viewOnMap = (spot: Spot) => {
    setMapLayer('visited');
    setFocusedSpotId(spot.id);
    setTab('map');
  };

  const exploreMap = () => {
    setMapLayer('all');
    setFocusedSpotId(null);
    setTab('map');
  };

  const openPhoto = (photos: OwnedPhoto[], index: number) => {
    const photoSpots = Object.fromEntries(photos.flatMap((p): [string, Spot][] => (p.spot ? [[p.spot_id, p.spot]] : [])));
    const current = photos[index];
    openLightbox(photos, current?.spot ?? null, index, {
      photoSpots,
      onViewSpot: viewOnMap,
    });
  };

  if (loadError) {
    return <div className="max-w-[1600px] mx-auto px-4 py-16 text-center text-sm text-forest-700/70 dark:text-sand-300/70">{t('loadError')}</div>;
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <div className="mt-6 mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-700 text-forest-800 dark:text-sand-100">{t('passportTitle')}</h1>
        <p className="text-forest-700/60 dark:text-sand-300/60 text-sm mt-1">{t('passportSubtitle')}</p>
      </div>

      {spots.length === 0 ? (
        <div className="grid place-items-center h-96">
          <div className="w-10 h-10 rounded-full border-2 border-forest-300 border-t-forest-600 animate-spin" />
        </div>
      ) : (
        <>
          <IdentityBlock
            t={t}
            lang={passLang}
            xp={xp}
            progress={progress}
            onViewProfile={setPhotographerOpen}
          />

          <ConquestBlock t={t} lang={passLang} snapshot={conquest} totalLikes={totalLikes} onExplore={exploreMap} />
          <PassportMapPanel key={lang} t={t} lang={lang} visitedSpots={visitedSpots} />

          <div className="mt-8" />
          <RetoBadgesBlock
            t={t}
            values={retoValues}
            tiers={retoTiers}
          />

          <section className="mt-10">
            <h2 className="font-display text-xl sm:text-2xl font-700 text-forest-800 dark:text-sand-100 mb-4">{ACTIVITY_I18N.tabs[activityTab][actLang]}</h2>
            <div className="flex flex-wrap gap-2 mb-5">
              {([
                ['photos', '📸', ownPhotos.length],
                ['likes', '❤️', likedWithSpots.length],
                ['reviews', '⭐', reviewedSpots.length],
              ] as const).map(([id, emoji, count]) => {
                const active = activityTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => { setActivityTab(id); setVisibleCount(6); }}
                    className={`px-4 py-2 rounded-full text-sm font-600 transition-colors ${active
                      ? 'bg-forest-700 text-white'
                      : 'bg-forest-50 dark:bg-slate2-900 text-forest-800 dark:text-sand-100 hover:bg-forest-100 dark:hover:bg-slate2-800'}`}
                  >
                    {emoji} {ACTIVITY_I18N.tabs[id][actLang]} ({count})
                  </button>
                );
              })}
            </div>

            {activityTab === 'photos' && (
              <PortfolioBlock t={t} lang={passLang} photos={ownPhotos} awards={awards} onOpenPhoto={openPhoto} visibleCount={visibleCount} onLoadMore={() => setVisibleCount((p) => p + 6)} />
            )}

            {activityTab === 'likes' && (likedWithSpots.length === 0 ? (
              <EmptyHint text={ACTIVITY_I18N.empty.likes[actLang]} />
            ) : (
              <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {likedWithSpots.slice(0, visibleCount).map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => openPhoto(likedWithSpots, i)}
                    className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-forest-50 dark:bg-slate2-900"
                  >
                    <img
                      src={p.image_url}
                      alt={p.spot ? spotName(p.spot) : ''}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    {p.spot && (
                      <span className="absolute inset-x-0 bottom-0 px-3 py-2 text-left text-xs font-600 text-white bg-gradient-to-t from-black/70 to-transparent">
                        {spotName(p.spot)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {likedWithSpots.length > visibleCount && (
                <button onClick={() => setVisibleCount((p) => p + 6)} className="w-full py-2.5 mt-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-all active:scale-[0.99]">
                  ▾ {t('loadMore')} ({t('showingCounter', { current: visibleCount, total: likedWithSpots.length })})
                </button>
              )}
              </>
            ))}

            {activityTab === 'reviews' && (reviewedSpots.length === 0 ? (
              <EmptyHint text={ACTIVITY_I18N.empty.reviews[actLang]} />
            ) : (
              <>
              <ul className="flex flex-col gap-3">
                {reviewedSpots.slice(0, visibleCount).map((r) => (
                  <li
                    key={r.spotId}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-forest-50 dark:bg-slate2-900 border border-forest-100 dark:border-slate2-800"
                  >
                    {r.image && (
                      <img src={r.image} alt={r.spotName} className="w-full sm:w-20 h-20 rounded-xl object-cover shrink-0" loading="lazy" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-700 text-forest-800 dark:text-sand-100">{r.spotName}</p>
                      <p className="text-xs text-forest-700/60 dark:text-sand-300/60 mt-0.5">{r.province}</p>
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-1.5 font-700">⭐ {r.overall.toFixed(1)} / 5</p>
                      {r.tip && <p className="text-sm text-forest-700/80 dark:text-sand-300/80 mt-2">“{r.tip}”</p>}
                    </div>
                    <button
                      onClick={() => { const spot = spots.find((s) => s.id === r.spotId); if (spot) viewOnMap(spot); }}
                      className="shrink-0 self-start sm:self-center px-4 py-2 rounded-xl bg-forest-600 text-white text-sm font-600 hover:bg-forest-700 transition-colors"
                    >
                      🗺️ {ACTIVITY_I18N.viewOnMap[actLang]}
                    </button>
                  </li>
                ))}
              </ul>
              {reviewedSpots.length > visibleCount && (
                <button onClick={() => setVisibleCount((p) => p + 6)} className="w-full py-2.5 mt-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-all active:scale-[0.99]">
                  ▾ {t('loadMore')} ({t('showingCounter', { current: visibleCount, total: reviewedSpots.length })})
                </button>
              )}
              </>
            ))}
          </section>

          <VisitedRankingBlock t={t} items={ranked} onViewOnMap={viewOnMap} />
        </>
      )}
    </div>
  );
}

function spotName(spot: Spot): string {
  return basqueName(spot.id, spot.name);
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="text-sm text-center text-forest-700/60 dark:text-sand-300/60 py-10 px-6 max-w-md mx-auto">
      {text}
    </p>
  );
}
