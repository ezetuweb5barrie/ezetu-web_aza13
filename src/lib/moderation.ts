import type { LangCode } from './types';

export type ModerationReportType = 'photo' | 'tip';
export type ModerationReportStatus = 'pending' | 'resolved';

export interface ModerationReport {
  id: string;
  type: ModerationReportType;
  status: ModerationReportStatus;
  reason: string;
  reporterComment: string | null;
  /** Photo reports */
  targetId: string;
  imageUrl: string | null;
  spotName: string;
  author: string;
  /** Tip reports */
  tipText: string | null;
  createdAt: string;
}

const KEY = 'ezetu_moderation_reports';
const BANNED_KEY = 'ezetu_banned_users';

function makeId(): string {
  return `rep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function seedReports(): ModerationReport[] {
  return [
    {
      id: 'rep_sample_photo_ai',
      type: 'photo',
      status: 'pending',
      reason: 'ai_generated',
      reporterComment: null,
      targetId: 's101',
      imageUrl: 'https://images.pexels.com/photos/29809979/pexels-photo-29809979.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      spotName: 'Gaztelugatxe',
      author: '@usuario_fake',
      tipText: null,
      createdAt: '2026-11-09T10:24:00.000Z',
    },
    {
      id: 'rep_sample_tip_spam',
      type: 'tip',
      status: 'pending',
      reason: 'spam',
      reporterComment: null,
      targetId: 'tip_tre_cime_spam',
      imageUrl: null,
      spotName: 'Tre Cime',
      author: '@criptoboy',
      tipText: 'Visita mi web de cryptos www.spam.com',
      createdAt: '2026-11-10T18:03:00.000Z',
    },
  ];
}

export function loadReports(): ModerationReport[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedReports();
    const arr = JSON.parse(raw) as ModerationReport[];
    return Array.isArray(arr) ? arr : seedReports();
  } catch {
    return seedReports();
  }
}

export function persistReports(reports: ModerationReport[]) {
  try { localStorage.setItem(KEY, JSON.stringify(reports)); } catch { /* ignore */ }
}

export function loadBannedUsers(): string[] {
  try {
    const raw = localStorage.getItem(BANNED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function persistBannedUsers(names: string[]) {
  try { localStorage.setItem(BANNED_KEY, JSON.stringify(names)); } catch { /* ignore */ }
}

export function newReportId(): string {
  return makeId();
}

export function isUserBanned(name: string, banned: string[]): boolean {
  if (!name) return false;
  const n = name.replace(/^@/, '').toLowerCase();
  return banned.some((b) => b.replace(/^@/, '').toLowerCase() === n);
}

export const REASON_LABELS: Record<LangCode, Record<string, string>> = {
  ES: {
    ai_generated: 'Imagen generada con IA',
    fake_place: 'Lugar falso',
    wrong_place: 'Lugar incorrecto',
    people_selfie: 'Personas o selfie',
    plagiarism: 'Plagio',
    spam: 'Spam o publicidad',
    abuse: 'Abuso o insultos',
    false_info: 'Información falsa',
  },
  EUS: {
    ai_generated: 'AIaren bidez sortutako irudia',
    fake_place: 'Leku faltsua',
    wrong_place: 'Okerreko lekua',
    people_selfie: 'Pertsonak edo selfie',
    plagiarism: 'Plagioa',
    spam: 'Spam edo publizitatea',
    abuse: 'Gaztigatzea edo irainak',
    false_info: 'Informazio faltsua',
  },
  EN: {
    ai_generated: 'AI-generated image',
    fake_place: 'Fake place',
    wrong_place: 'Wrong place',
    people_selfie: 'People or selfie',
    plagiarism: 'Plagiarism',
    spam: 'Spam or advertising',
    abuse: 'Abuse or insults',
    false_info: 'False information',
  },
  FR: {}, DE: {}, IT: {},
};

export const MOD_PANEL_STRINGS = {
  title: { es: 'Panel de Moderación', eu: 'Moderatzaile Panela', en: 'Moderation Panel' },
  tabPhotos: { es: 'Fotos denunciadas', eu: 'Salatutako argazkiak', en: 'Reported Photos' },
  tabTips: { es: 'Consejos denunciados', eu: 'Salatutako aholkuak', en: 'Reported Tips' },
  empty: {
    es: 'Todo limpio. No hay denuncias pendientes de revisión.',
    eu: 'Dena garbi. Ez dago berrikusteko salaketarik.',
    en: 'All clear. No pending reports to review.',
  },
  deleteBtn: { es: 'Borrar contenido', eu: 'Ezabatu', en: 'Delete content' },
  banBtn: { es: 'Bloquear usuario', eu: 'Blokeatu erabiltzailea', en: 'Ban user' },
  dismissBtn: { es: 'Descartar', eu: 'Baztertu', en: 'Dismiss' },
  by: { es: 'Autor', eu: 'Egilea', en: 'Author' },
  spot: { es: 'Lugar', eu: 'Lekua', en: 'Spot' },
  comment: { es: 'Comentario del denunciante', eu: 'Salatzailearen iruzkina', en: "Reporter's comment" },
  role: { es: 'Rol de prueba', eu: 'Froga-rola', en: 'Test Role' },
  roleUser: { es: 'Usuario normal', eu: 'Erabiltzaile arrunta', en: 'Standard User' },
  roleAdmin: { es: 'Administrador', eu: 'Administratzailea', en: 'Administrator' },
  moderationPanel: { es: 'Panel de Moderación', eu: 'Moderatzaile Panela', en: 'Moderation Panel' },
  deletedToast: { es: 'Contenido eliminado y denuncia resuelta', eu: 'Edukia ezabatua eta salaketa ebaztua', en: 'Content deleted and report resolved' },
  bannedToast: { es: 'Usuario bloqueado y denuncia resuelta', eu: 'Erabiltzailea blokeatua eta salaketa ebaztua', en: 'User banned and report resolved' },
  dismissedToast: { es: 'Denuncia descartada', eu: 'Salaketa baztertua', en: 'Report dismissed' },
} as const;

export function modStrings(lang: LangCode) {
  const key = lang === 'EUS' ? 'eu' : lang === 'EN' ? 'en' : 'es';
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(MOD_PANEL_STRINGS)) {
    out[k] = (v as Record<string, string>)[key];
  }
  return out;
}
