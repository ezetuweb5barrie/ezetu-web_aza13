import { useEffect, useMemo, useState } from 'react';
import { Heart, MapPin, Camera, Flame, Sparkles, CalendarDays, History, Users } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { fetchPhotos, fetchHeroPhoto } from '@/lib/data';
import { useFollowedUsers } from '@/lib/followed-users';
import { formatLikes, categoryColor, basqueName, translatedText } from '@/lib/utils';
import { LANG_KEY } from '@/lib/types';
import type { Photo, Spot } from '@/lib/types';
import { PhotoCard } from './PhotoCard';
import { TheBestView } from './TheBestView';
import { VerifiedPhotoBadge } from './VerifiedPhotoBadge';
import { ProtectedPhoto } from './ProtectedPhoto';
import { PlaceBreadcrumb } from './PlaceBreadcrumb';

type FilterId = 'trending' | 'new' | 'month' | 'historic' | 'following';

const FILTERS: { id: FilterId; icon: typeof Flame }[] = [
  { id: 'trending', icon: Flame },
  { id: 'new', icon: Sparkles },
  { id: 'month', icon: CalendarDays },
  { id: 'historic', icon: History },
  { id: 'following', icon: Users },
];

const FILTER_LABELS: Record<FilterId, Record<string, string>> = {
  trending: { ES: 'Tendencias', EUS: 'Joerak', EN: 'Trending' },
  new: { ES: 'Nuevas', EUS: 'Berriak', EN: 'Newest' },
  month: { ES: 'Este mes', EUS: 'Hilabete honetan', EN: 'This Month' },
  historic: { ES: 'Histórico', EUS: 'Historikoa', EN: 'All-Time' },
  following: { ES: 'Siguiendo', EUS: 'Jarraitzen', EN: 'Following' },
};

const FOLLOWING_EMPTY: Record<string, string> = {
  ES: 'Aún no sigues a ningún fotógrafo. Explora la galería y sigue a tus creadores favoritos.',
  EUS: 'Oraindik ez duzu argazkilaririk jarraitzen. Arakatu galeria eta jarraitu zure gogoko sortzaileei.',
  EN: "You're not following any photographers yet. Explore the gallery and follow your favorite creators.",
};

const CATEGORIES = ['all', 'city', 'village', 'nature'];

function getTrendingScore(p: Photo & { spot?: Spot }): number {
  const hours = Math.max(0, (Date.now() - new Date(p.created_at || p.device_id || Date.now()).getTime()) / 3600000);
  return ((p.likes || 0) + 1) / Math.pow(hours + 2, 1.5);
}

export function GalleryView(_: { refreshKey?: number }) {
  const { t, lang, setTab, setFocusedSpotId, setPhotographerOpen, openLightbox, closeLightbox,
    deletedPhotoIds, bannedUsers } = useApp();
  const [galleryMode, setGalleryMode] = useState<'feed' | 'best'>('feed');
  const [filter, setFilter] = useState<FilterId>('trending');
  const [category, setCategory] = useState('all');
  const [visiblePhotosCount, setVisiblePhotosCount] = useState(12);
  const [photos, setPhotos] = useState<(Photo & { spot?: Spot })[]>([]);
  const [hero, setHero] = useState<(Photo & { spot?: Spot }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroLoading, setHeroLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setHeroLoading(true);
      try { setHero(await fetchHeroPhoto()); } catch { /* ignore */ }
      setHeroLoading(false);
    })();
  }, []);

  useEffect(() => {
    setVisiblePhotosCount(12);
  }, [filter, category]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { setPhotos(await fetchPhotos({ season: 'all', category })); }
      catch { setPhotos([]); }
      setLoading(false);
    })();
  }, [category]);

  const followedUsers = useFollowedUsers();
  const followedNames = useMemo(() => followedUsers.map((u) => u.name), [followedUsers]);

  const filtered = useMemo(() => {
    const deleted = new Set(deletedPhotoIds);
    const banned = new Set(bannedUsers.map((b) => b.replace(/^@/, '').toLowerCase()));
    let base = photos.filter((p) => !deleted.has(p.id) && !banned.has(p.author.replace(/^@/, '').toLowerCase()));
    if (category !== 'all') base = base.filter((p) => p.spot?.category === category);
    if (filter === 'following') {
      base = base.filter((p) => followedNames.includes(p.author));
    } else if (filter === 'month') {
      const cutoff = Date.now() - 30 * 86400000;
      base = base.filter((p) => new Date(p.created_at).getTime() >= cutoff);
    }
    const sorted = [...base];
    if (filter === 'trending') sorted.sort((a, b) => getTrendingScore(b) - getTrendingScore(a));
    else if (filter === 'new') sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    return sorted;
  }, [photos, category, filter, deletedPhotoIds, bannedUsers, followedNames]);

  const heroVisible = hero && !deletedPhotoIds.includes(hero.id)
    && !bannedUsers.some((b) => b.replace(/^@/, '').toLowerCase() === hero.author.replace(/^@/, '').toLowerCase())
    ? hero : null;
  const heroVisibleSpot = heroVisible?.spot;

  const heroSpot = hero?.spot;
  const heroIsEus = lang === 'EUS' && heroSpot?.euskal_herria;
  const heroDescription = heroSpot ? translatedText(heroSpot.translations, LANG_KEY[lang], heroSpot.description) : null;

  const openInMap = (spotId: string) => {
    setFocusedSpotId(spotId);
    setTab('map');
  };

  const handleViewSpot = (s: Spot) => {
    closeLightbox();
    setFocusedSpotId(s.id);
    setTab('map');
  };

  const openHeroLightbox = () => {
    if (!heroVisible) return;
    openLightbox([heroVisible], heroVisibleSpot ?? null, 0, { photoSpots: heroVisibleSpot ? { [heroVisible.id]: heroVisibleSpot } : undefined, onViewSpot: handleViewSpot });
  };

  const filterLabel = (id: FilterId) => FILTER_LABELS[id][lang] ?? FILTER_LABELS[id].ES;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      {/* Sub-nav: Feed vs The Best */}
      <div className="flex justify-center mt-6 mb-4">
        <div className="flex gap-0.5 p-1 rounded-2xl bg-forest-50 dark:bg-slate2-900/60 border border-forest-100 dark:border-slate2-800">
          <button
            onClick={() => setGalleryMode('feed')}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-600 whitespace-nowrap transition-all ${
              galleryMode === 'feed'
                ? 'bg-white dark:bg-slate2-800 text-forest-800 dark:text-sand-100 shadow-soft'
                : 'text-forest-700/70 dark:text-sand-300/70 hover:text-forest-800 dark:hover:text-sand-100'
            }`}
          >
            📸 {t('exploreFeed')}
          </button>
          <button
            onClick={() => setGalleryMode('best')}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-600 whitespace-nowrap transition-all ${
              galleryMode === 'best'
                ? 'bg-amber-500 text-white shadow-soft'
                : 'text-forest-700/70 dark:text-sand-300/70 hover:text-forest-800 dark:hover:text-sand-100'
            }`}
          >
            🏆 {t('theBest')}
          </button>
        </div>
      </div>

      {galleryMode === 'best' && <TheBestView />}

      {galleryMode === 'feed' && (
      <>
      {/* Hero */}
      <section className="mt-6 mb-8 animate-fadeIn">
        <div className="relative rounded-3xl overflow-hidden shadow-lift bg-forest-900">
          {heroVisible ? (
            <div className="relative h-[60vh] min-h-[420px] max-h-[640px] cursor-pointer group" onClick={openHeroLightbox}>
              <ProtectedPhoto src={heroVisible.image_url} alt={heroSpot?.name ?? ''} className="object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

              {heroVisible.camera_model && (
                <div className="absolute top-4 left-4 z-30 pointer-events-auto">
                  <VerifiedPhotoBadge />
                </div>
              )}

              <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-full bg-terracotta-500 text-white text-[11px] font-700 uppercase tracking-wider">
                    {t('photoOfDay')}
                  </span>
                </div>
                <h1 className="font-display text-4xl sm:text-6xl font-700 tracking-tight drop-shadow-lg max-w-3xl">
                  {heroSpot ? (heroIsEus ? basqueName(heroSpot.id, heroSpot.name) : heroSpot.name) : 'Ezetu'}
                </h1>
                {heroSpot && <PlaceBreadcrumb spot={heroSpot} tone="onDark" className="mt-3" />}
                <p className="mt-2 text-white/80 text-sm sm:text-base max-w-2xl">
                  {heroDescription ?? t('tagline')}
                </p>
                {/* Photographer attribution */}
                <button
                  onClick={(e) => { e.stopPropagation(); setPhotographerOpen(heroVisible.author); }}
                  className="mt-3 inline-flex items-center gap-2 text-white/85 text-sm hover:text-terracotta-300 transition-colors w-fit"
                >
                  <span className="grid place-items-center w-7 h-7 rounded-full bg-white/15 backdrop-blur text-xs font-700 shrink-0">
                    {heroVisible.author.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-600">{t('photoBy')}: {heroVisible.author}</span>
                </button>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {heroVisibleSpot && (
                    <button onClick={(e) => { e.stopPropagation(); openInMap(heroVisibleSpot.id); }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white text-forest-800 font-600 hover:bg-sand-100 transition-colors shadow-soft">
                      <MapPin className="w-4 h-4" />
                      {t('viewOnMap')}
                    </button>
                  )}
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/15 backdrop-blur text-white font-600">
                    <Heart className="w-4 h-4 fill-terracotta-400 text-terracotta-400" />
                    {formatLikes(heroVisible.likes)} {t('likes')}
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-white/60 text-xs">
                    <Camera className="w-3.5 h-3.5" />
                    <span>{t('viewSpotCard')}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : heroLoading ? (
            <div className="h-[50vh] min-h-[380px] grid place-items-center">
              <div className="w-10 h-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            </div>
          ) : (
            <div className="h-[40vh] grid place-items-center text-white/80 p-8">
              <p className="text-center">{t('empty')}</p>
            </div>
          )}
        </div>
        <p className="mt-4 text-forest-700/70 dark:text-sand-300/70 text-sm">{t('gallerySubtitle')}</p>
      </section>

      {/* Filters */}
      <div className="sticky top-16 z-30 -mx-4 px-4 sm:mx-0 sm:px-0 py-3 mb-6 bg-sand-50/80 dark:bg-slate2-950/80 backdrop-blur-xl rounded-b-2xl border-b border-forest-100/60 dark:border-slate2-800/60">
        <div className="flex flex-col gap-3">
          {/* Feed filters */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {FILTERS.map((f) => {
              const Icon = f.icon;
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-600 whitespace-nowrap transition-all ${
                    active
                      ? 'bg-forest-600 text-white shadow-soft'
                      : 'bg-white dark:bg-slate2-900 text-forest-700/70 dark:text-sand-300/70 hover:bg-forest-50 dark:hover:bg-slate2-800 border border-forest-100 dark:border-slate2-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {filterLabel(f.id)}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            {/* Category */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {CATEGORIES.map((c) => {
                const active = category === c;
                const cc = c !== 'all' ? categoryColor(c) : null;
                return (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-600 transition-all ${
                      active
                        ? 'bg-forest-700 text-white'
                        : 'bg-white dark:bg-slate2-900 text-forest-700/70 dark:text-sand-300/70 border border-forest-100 dark:border-slate2-800 hover:border-forest-300'
                    }`}
                  >
                    {c === 'all' ? `🌍 ${t('all')}` : c === 'city' ? `🏙️ ${t('cities')}` : c === 'village' ? `🏘️ ${t('villages')}` : `🌲 ${t('nature')}`}
                    {cc && null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Masonry */}
      {loading ? (
        <div className="masonry">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-forest-50 dark:bg-slate2-850 overflow-hidden" style={{ aspectRatio: 0.7 + (i % 3) * 0.25 }}>
              <div className="w-full h-full shimmer-bg animate-shimmer bg-forest-100/40 dark:bg-slate2-800/40" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center text-forest-700/60 dark:text-sand-300/60">
          {filter === 'following' ? (FOLLOWING_EMPTY[lang] ?? FOLLOWING_EMPTY.ES) : t('empty')}
        </div>
      ) : (
        <>
        <div className="masonry">
          {filtered.slice(0, visiblePhotosCount).map((p, i) => (
            <PhotoCard key={p.id} photo={p} spot={p.spot} onSpotClick={openInMap} allPhotos={filtered} photoIndex={i} />
          ))}
        </div>
        {filtered.length > visiblePhotosCount && (
          <div className="flex justify-center">
            <button
              onClick={() => setVisiblePhotosCount((prev) => prev + 12)}
              className="px-6 py-3 my-8 mx-auto rounded-full bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-sm font-semibold shadow-lg flex items-center gap-2 transition-all"
            >
              ▾ {t('loadMore')} ({visiblePhotosCount} / {filtered.length})
            </button>
          </div>
        )}
        </>
      )}
      </>
      )}
    </div>
  );
}
