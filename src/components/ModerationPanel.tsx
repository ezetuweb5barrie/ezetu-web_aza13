import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { REASON_LABELS, modStrings } from '@/lib/moderation';
import type { ModerationReport } from '@/lib/moderation';
import type { LangCode } from '@/lib/types';

export function ModerationPanel() {
  const {
    lang, moderationReports, deleteReportedItem, dismissReport, banUser,
    setModerationOpen, showToast,
  } = useApp();
  const [tab, setTab] = useState<'photo' | 'tip'>('photo');

  const s = useMemo(() => modStrings(lang), [lang]);

  const pending = moderationReports.filter((r) => r.status === 'pending');
  const photoReports = pending.filter((r) => r.type === 'photo');
  const tipReports = pending.filter((r) => r.type === 'tip');
  const visible = tab === 'photo' ? photoReports : tipReports;

  const reasonLabel = (reason: string) => REASON_LABELS[lang as LangCode]?.[reason] ?? reason;

  const handleDelete = (r: ModerationReport) => {
    deleteReportedItem(r.id, r.type, r.targetId);
    showToast(s.deletedToast, '🗑️');
  };

  const handleBan = (r: ModerationReport) => {
    banUser(r.author, r.id);
    showToast(s.bannedToast, '🚫');
  };

  const handleDismiss = (r: ModerationReport) => {
    dismissReport(r.id);
    showToast(s.dismissedToast, '✓');
  };

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={() => setModerationOpen(false)} />
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl bg-white dark:bg-slate2-900 shadow-lift border border-forest-100 dark:border-slate2-800 overflow-hidden animate-popIn">
        {/* Header */}
        <div className="sticky top-0 shrink-0 bg-gradient-to-br from-forest-600 to-forest-800 dark:from-slate2-800 dark:to-slate2-950 text-white px-5 py-4">
          <button
            onClick={() => setModerationOpen(false)}
            className="absolute top-3.5 right-3.5 grid place-items-center w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="font-display text-xl font-700 flex items-center gap-2">
            🛡️ {s.title}
          </h2>
        </div>

        {/* Filter tabs */}
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-forest-100 dark:border-slate2-800 flex gap-2">
          <button
            onClick={() => setTab('photo')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-600 transition-all ${
              tab === 'photo'
                ? 'bg-forest-600 text-white shadow-soft'
                : 'bg-forest-50 dark:bg-slate2-850 text-forest-700/70 dark:text-sand-300/70 hover:bg-forest-100 dark:hover:bg-slate2-800'
            }`}
          >
            📸 {s.tabPhotos} ({photoReports.length})
          </button>
          <button
            onClick={() => setTab('tip')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-600 transition-all ${
              tab === 'tip'
                ? 'bg-forest-600 text-white shadow-soft'
                : 'bg-forest-50 dark:bg-slate2-850 text-forest-700/70 dark:text-sand-300/70 hover:bg-forest-100 dark:hover:bg-slate2-800'
            }`}
          >
            💬 {s.tabTips} ({tipReports.length})
          </button>
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {visible.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-2xl mb-3">✓</p>
              <p className="text-sm font-600 text-forest-700/70 dark:text-sand-300/70">{s.empty}</p>
            </div>
          ) : (
            visible.map((r) => (
              <div key={r.id} className="rounded-2xl border border-forest-100 dark:border-slate2-800 bg-sand-50/60 dark:bg-slate2-850/60 p-3.5">
                <div className="flex gap-3">
                  {r.type === 'photo' && r.imageUrl ? (
                    <img
                      src={r.imageUrl}
                      alt=""
                      className="w-20 h-20 rounded-xl object-cover shrink-0 bg-forest-100 dark:bg-slate2-800"
                      draggable={false}
                    />
                  ) : (
                    <blockquote className="flex-1 text-sm text-forest-800 dark:text-sand-100 italic bg-white dark:bg-slate2-850 border-l-4 border-terracotta-400 rounded-r-xl px-3 py-2.5">
                      “{r.tipText}”
                    </blockquote>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2 py-0.5 rounded-full bg-terracotta-100 dark:bg-terracotta-900/30 text-terracotta-700 dark:text-terracotta-300 text-[11px] font-700">
                        {reasonLabel(r.reason)}
                      </span>
                    </div>
                    <p className="text-xs text-forest-700/80 dark:text-sand-300/80">
                      <span className="font-600">{s.spot}:</span> {r.spotName}
                    </p>
                    <p className="text-xs text-forest-700/80 dark:text-sand-300/80 truncate">
                      <span className="font-600">{s.by}:</span> {r.author}
                    </p>
                    {r.reporterComment && (
                      <p className="text-[11px] text-forest-700/60 dark:text-sand-300/60 mt-1 italic">
                        {s.comment}: “{r.reporterComment}”
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => handleDelete(r)}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-700 hover:bg-red-700 transition-colors"
                  >
                    🗑️ {s.deleteBtn}
                  </button>
                  <button
                    onClick={() => handleBan(r)}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs font-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    🚫 {s.banBtn}
                  </button>
                  <button
                    onClick={() => handleDismiss(r)}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate2-800 text-slate-600 dark:text-sand-300 text-xs font-700 hover:bg-slate-200 dark:hover:bg-slate2-700 transition-colors"
                  >
                    ✓ {s.dismissBtn}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
