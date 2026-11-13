import { useMemo, useState } from 'react';
import { Lock, Map as MapIcon, Search } from 'lucide-react';
import { PassportModal } from './PassportModal';
import { Ikurrina } from '@/components/Ikurrina';
import { useApp } from '@/lib/app-context';
import type { PassportKey, PassportT } from '@/lib/passport-strings';
import type { ConquestRow } from '@/lib/passport-conquest';
import { CONTINENT_ORDER, type ContinentId } from '@/lib/world-countries';

export const CONTINENT_KEYS: Record<ContinentId, PassportKey> = {
  europe: 'cont_eu',
  americas: 'cont_am',
  asia: 'cont_as',
  africa: 'cont_af',
  oceania: 'cont_oc',
  antarctica: 'cont_an',
};

const FILTER_CONTINENTS = CONTINENT_ORDER.filter((c) => c !== 'antarctica');

const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const CONQUERED_LABEL: Record<string, string> = {
  ES: 'Conquistado',
  EUS: 'Esploratua',
  EN: 'Visited',
};

const PENDING_LABEL: Record<string, string> = {
  ES: 'Pendiente',
  EUS: 'Esploratzeke',
  EN: 'Pending',
};

function flagEmoji(code: string): string {
  if (code.length !== 2) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

interface WorldChecklistModalProps {
  title: string;
  rows: ConquestRow[];
  t: PassportT;
  onExplore: () => void;
  onClose: () => void;
}

export function WorldChecklistModal({ title, rows, t, onExplore, onClose }: WorldChecklistModalProps) {
  const [query, setQuery] = useState('');
  const [continent, setContinent] = useState<ContinentId | 'all'>('all');
  const { lang, navigateToRankings } = useApp();

  const filtered = useMemo(() => {
    const q = stripAccents(query);
    return rows.filter((r) =>
      (continent === 'all' || r.continent === continent)
      && (q === '' || stripAccents(r.name).includes(q) || stripAccents(r.sub).includes(q)));
  }, [rows, query, continent]);

  const visited = filtered.filter((r) => r.visited);
  const pending = filtered.filter((r) => !r.visited);
  const hasPendingOverall = rows.some((r) => !r.visited);

  const conqueredLabel = CONQUERED_LABEL[lang] ?? CONQUERED_LABEL.ES;
  const pendingLabel = PENDING_LABEL[lang] ?? PENDING_LABEL.ES;

  const openInRankings = (r: ConquestRow) => {
    onClose();
    navigateToRankings({
      continent: '',
      country: r.id === 'EH' ? 'EUS' : r.id,
      province: 'all',
    });
  };

  return (
    <PassportModal title={title} onClose={onClose} closeLabel={t('close')}>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-700/50 dark:text-sand-300/50" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-forest-50 dark:bg-slate2-900 border border-forest-100 dark:border-slate2-800 text-sm text-forest-800 dark:text-sand-100 placeholder:text-forest-700/50 dark:placeholder:text-sand-300/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {(['all', ...FILTER_CONTINENTS] as const).map((id) => {
          const active = continent === id;
          return (
            <button
              key={id}
              onClick={() => setContinent(id)}
              className={`px-3 py-1.5 rounded-full text-xs font-600 transition-colors ${active
                ? 'bg-forest-700 text-white'
                : 'bg-forest-50 dark:bg-slate2-900 text-forest-800 dark:text-sand-100 hover:bg-forest-100 dark:hover:bg-slate2-800'}`}
            >
              {id === 'all' ? t('filterAll') : t(CONTINENT_KEYS[id])}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-center text-forest-700/60 dark:text-sand-300/60 py-6">{t('noResults')}</p>
      )}

      <Group label={t('checklistVisited')} count={visited.length} rows={visited} t={t} conqueredLabel={conqueredLabel} pendingLabel={pendingLabel} onSelect={openInRankings} />
      <Group label={t('checklistPending')} count={pending.length} rows={pending} t={t} conqueredLabel={conqueredLabel} pendingLabel={pendingLabel} onSelect={openInRankings} />

      {hasPendingOverall && (
        <button
          onClick={onExplore}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-forest-600 to-forest-700 text-white font-600 shadow-soft hover:shadow-lift transition-shadow"
        >
          <MapIcon className="w-4 h-4" />
          {t('exploreBtn')}
        </button>
      )}
    </PassportModal>
  );
}

function CountryFlag({ row, visited }: { row: ConquestRow; visited: boolean }) {
  if (row.ikurrina) {
    return (
      <span className={`shrink-0 ${visited ? '' : 'opacity-35 grayscale'}`}>
        <Ikurrina className="w-8 h-5 rounded-[3px] shadow-sm" />
      </span>
    );
  }
  const emoji = flagEmoji(row.id);
  if (!emoji) {
    return (
      <span className={`shrink-0 grid place-items-center w-8 h-5 rounded-[3px] bg-slate-200 dark:bg-slate2-700 ${visited ? '' : 'opacity-40'}`}>
        <Lock className="w-3 h-3 text-slate-500 dark:text-sand-300/60" />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={row.name}
      className={`shrink-0 text-2xl leading-none ${visited ? '' : 'opacity-35 grayscale'}`}
    >
      {emoji}
    </span>
  );
}

function Group({ label, count, rows, t, conqueredLabel, pendingLabel, onSelect }: {
  label: string;
  count: number;
  rows: ConquestRow[];
  t: PassportT;
  conqueredLabel: string;
  pendingLabel: string;
  onSelect: (r: ConquestRow) => void;
}) {
  if (rows.length === 0) return null;
  const isVisited = rows[0].visited;
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="text-xs uppercase tracking-wider text-forest-700/60 dark:text-sand-300/60 mb-2">{label} ({count})</h3>
      <div className="flex flex-col gap-2 w-full">
        {rows.map((r) => (
          <div
            key={r.id}
            onClick={() => onSelect(r)}
            className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer border transition-colors ${
              isVisited
                ? 'bg-forest-50 dark:bg-slate2-900 hover:bg-slate-100 dark:hover:bg-slate-800 border-forest-200/60 dark:border-forest-700/40'
                : 'bg-slate-50 dark:bg-slate2-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent dark:border-slate2-800/60'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <CountryFlag row={r} visited={isVisited} />
              <div className="flex flex-col min-w-0">
                <span className={`whitespace-normal leading-tight ${isVisited ? 'font-700 text-forest-900 dark:text-white text-sm sm:text-base' : 'font-600 text-forest-800/80 dark:text-slate-300 text-sm'}`}>{r.name}</span>
                <span className="text-xs text-forest-700/60 dark:text-slate-400 mt-0.5">{r.sub}</span>
              </div>
            </div>
            {isVisited ? (
              <span className="shrink-0 ml-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 text-xs font-700 whitespace-nowrap">
                ✓ {conqueredLabel}
              </span>
            ) : (
              <span className="shrink-0 ml-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200/70 dark:bg-slate2-800 text-forest-700/60 dark:text-slate-400 border border-transparent text-xs font-600 whitespace-nowrap">
                🔒 {pendingLabel}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
