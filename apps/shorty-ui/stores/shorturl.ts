import { defineStore } from 'pinia';
import { useRuntimeConfig } from '#imports';

export interface LinkHistoryItem {
  label: string;
  date: string;
  by: string;
  description?: string;
}

export interface DestinationUrlHistoryItem {
  id: string;
  destinationUrl: string;
  effectiveFrom: string;
  changedBy: string;
  isCurrent: boolean;
}

export interface LinkItem {
  id: string;
  title: string;
  longUrl: string;
  shortCode: string;
  shortUrl: string;
  created: string;
  clicks: number;
  tags: string[];
  expiresAt?: string | null;
  status: 'active' | 'archived';
  history?: LinkHistoryItem[];
  destinationHistory?: DestinationUrlHistoryItem[];
  // Every link has exactly one auto-generated QR code (see AGENTS.md) —
  // null only for links created before that change.
  qrCode?: QRCodeItem | null;
}

export interface QRCodeItem {
  id: string;
  title: string;
  longUrl: string;
  scans: number;
  color: string;
  bgColor: string;
  logo: string | null;
  created: string;
  style: string;
  corner?: string;
  overlayType?: 'none' | 'logo' | 'text' | string;
  overlayText?: string;
  linkId?: string | null;
  templateId?: string | null;
  frameId?: string | null;
}

export interface QRFrameItem {
  id: string;
  name: string;
  desc: string;
  frameType: 'bottom-label' | 'border' | 'top-header' | 'card-box' | 'custom-upload';
  frameColor: string;
  textColor: string;
  borderColor: string;
  qrPosition: 'center' | 'top' | 'bottom';
  qrSizePercent: number;
  ctaText: string;
  customImageUrl?: string | null;
  isCustom?: boolean;
}

export interface QRTemplateItem {
  id: string;
  name: string;
  desc: string;
  style: string;
  corner: string;
  fgColor: string;
  bgColor: string;
  overlayType: 'none' | 'logo' | 'text' | string;
  overlayText?: string;
  logo?: string | null;
  isCustom?: boolean;
}

export interface AnalyticsData {
  totalEngagements: number;
  totalClicks: number;
  totalScans: number;
  dates: string[];
  clicks: number[];
  scans: number[];
  engagements: number[];
  countries: { name: string; code?: string; count: number; percentage: number }[];
  cities: { name: string; count: number; percentage: number }[];
  devices: { name: string; count: number; percentage: number }[];
  referrers: { name: string; count: number; percentage: number }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiLink = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiQRCode = any;

function formatDate(value?: string | Date | null): string {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function mapLink(l: ApiLink): LinkItem {
  return {
    id: l.id,
    title: l.title,
    longUrl: l.longUrl,
    shortCode: l.shortCode,
    shortUrl: l.shortUrl,
    created: (l.createdAt || '').split('T')[0],
    clicks: l.clicks,
    tags: l.tags || [],
    expiresAt: l.expiresAt ? String(l.expiresAt).split('T')[0] : null,
    status: l.status,
    history: (l.history || []).map((h: ApiLink) => ({
      label: h.label,
      date: formatDate(h.createdAt),
      by: h.by,
      description: h.description,
    })),
    destinationHistory: (l.destinationHistory || []).map((d: ApiLink) => ({
      id: d.id,
      destinationUrl: d.destinationUrl,
      effectiveFrom: formatDate(d.effectiveFrom),
      changedBy: d.changedBy,
      isCurrent: d.isCurrent,
    })),
    qrCode: l.qrCode ? mapQRCode(l.qrCode) : null,
  };
}

function mapQRCode(q: ApiQRCode): QRCodeItem {
  return {
    id: q.id,
    title: q.title,
    longUrl: q.longUrl,
    scans: q.scans,
    color: q.color,
    bgColor: q.bgColor,
    logo: q.logo,
    created: (q.createdAt || '').split('T')[0],
    style: q.style,
    corner: q.corner,
    overlayType: q.overlayType,
    overlayText: q.overlayText,
    linkId: q.linkId,
    templateId: q.templateId,
    frameId: q.frameId,
  };
}

export const useShortUrlStore = defineStore('shorturl', {
  state: () => ({
    links: [] as LinkItem[],
    qrcodes: [] as QRCodeItem[],
    frames: [] as QRFrameItem[],
    templates: [] as QRTemplateItem[],
    isLoading: false,
    error: null as string | null,
  }),

  getters: {
    getLinkById: (state) => (id: string) => {
      return state.links.find((l) => l.id === id);
    },
    getQRCodeById: (state) => (id: string) => {
      return state.qrcodes.find((q) => q.id === id);
    },
    getFrameById: (state) => (id: string) => {
      return state.frames.find((f) => f.id === id);
    },
    getTemplateById: (state) => (id: string) => {
      return state.templates.find((t) => t.id === id);
    },
    getTotalClicks: (state) => {
      return state.links.reduce((acc, l) => acc + l.clicks, 0);
    },
    getTotalScans: (state) => {
      return state.qrcodes.reduce((acc, q) => acc + q.scans, 0);
    },
    getTotalEngagements: (state) => {
      const clicks = state.links.reduce((acc, l) => acc + l.clicks, 0);
      const scans = state.qrcodes.reduce((acc, q) => acc + q.scans, 0);
      return clicks + scans;
    },
    isLinkExpired: () => (link: LinkItem) => {
      if (!link.expiresAt) return false;
      const exp = new Date(link.expiresAt).getTime();
      const now = new Date().setHours(0, 0, 0, 0);
      return exp < now;
    },
  },

  actions: {
    apiBase(): string {
      return useRuntimeConfig().public.apiBase as string;
    },

    // ---------- Links ----------
    async fetchLinks(params?: { search?: string; status?: string; tag?: string; page?: number; limit?: number }) {
      this.isLoading = true;
      try {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        const response = await useHttp<{ items: ApiLink[] }>(`${this.apiBase()}/links${query ? `?${query}` : ''}`, {
          method: 'GET',
        });
        if (response.success) {
          this.links = response.data.items.map(mapLink);
        } else {
          this.error = 'Failed to load links';
        }
      } finally {
        this.isLoading = false;
      }
    },

    async fetchLink(id: string) {
      const response = await useHttp<ApiLink>(`${this.apiBase()}/links/${id}`, { method: 'GET' });
      if (!response.success) return null;
      const link = mapLink(response.data);
      const index = this.links.findIndex((l) => l.id === id);
      if (index !== -1) this.links[index] = link;
      else this.links.unshift(link);
      return link;
    },

    async addLink(
      title: string,
      longUrl: string,
      customBackHalf?: string,
      tags: string[] = [],
      expiresAt: string | null = null,
      templateId?: string | null,
      frameId?: string | null
    ) {
      const response = await useHttp<ApiLink>(`${this.apiBase()}/links`, {
        method: 'POST',
        body: {
          title,
          longUrl,
          customBackHalf: customBackHalf || undefined,
          tags,
          expiresAt,
          templateId: templateId || undefined,
          frameId: frameId || undefined,
        },
      });
      if (!response.success) throw new Error(response.error?.message || 'Failed to create link');
      const link = mapLink(response.data);
      this.links.unshift(link);
      return link;
    },

    async updateLink(id: string, updates: Partial<LinkItem>) {
      const response = await useHttp<ApiLink>(`${this.apiBase()}/links/${id}`, {
        method: 'PATCH',
        body: {
          title: updates.title,
          longUrl: updates.longUrl,
          tags: updates.tags,
          expiresAt: updates.expiresAt,
          status: updates.status,
        },
      });
      if (!response.success) throw new Error(response.error?.message || 'Failed to update link');
      // Re-fetch to get the refreshed history/destinationHistory rather than
      // trusting the PATCH response shape to include them.
      return this.fetchLink(id);
    },

    async deleteLink(id: string) {
      const response = await useHttp(`${this.apiBase()}/links/${id}`, { method: 'DELETE' });
      if (!response.success) throw new Error('Failed to delete link');
      this.links = this.links.filter((l) => l.id !== id);
    },

    // ---------- QR Codes ----------
    async fetchQRCodes(params?: { search?: string; page?: number; limit?: number }) {
      this.isLoading = true;
      try {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        const response = await useHttp<{ items: ApiQRCode[] }>(`${this.apiBase()}/qrcodes${query ? `?${query}` : ''}`, {
          method: 'GET',
        });
        if (response.success) {
          this.qrcodes = response.data.items.map(mapQRCode);
        } else {
          this.error = 'Failed to load QR codes';
        }
      } finally {
        this.isLoading = false;
      }
    },

    async fetchQRCode(id: string) {
      const response = await useHttp<ApiQRCode>(`${this.apiBase()}/qrcodes/${id}`, { method: 'GET' });
      if (!response.success) return null;
      const qr = mapQRCode(response.data);
      const index = this.qrcodes.findIndex((q) => q.id === id);
      if (index !== -1) this.qrcodes[index] = qr;
      else this.qrcodes.unshift(qr);
      return qr;
    },

    async updateQRCode(id: string, updates: Partial<QRCodeItem>) {
      const response = await useHttp<ApiQRCode>(`${this.apiBase()}/qrcodes/${id}`, {
        method: 'PATCH',
        body: updates,
      });
      if (!response.success) throw new Error(response.error?.message || 'Failed to update QR code');
      const qr = mapQRCode(response.data);
      const index = this.qrcodes.findIndex((q) => q.id === id);
      if (index !== -1) this.qrcodes[index] = qr;
      return qr;
    },

    // ---------- Templates ----------
    async fetchTemplates() {
      const response = await useHttp<QRTemplateItem[]>(`${this.apiBase()}/templates`, { method: 'GET' });
      if (response.success) this.templates = response.data;
    },

    async addTemplate(template: Omit<QRTemplateItem, 'id'>) {
      const response = await useHttp<QRTemplateItem>(`${this.apiBase()}/templates`, {
        method: 'POST',
        body: template,
      });
      if (!response.success) throw new Error(response.error?.message || 'Failed to create template');
      this.templates.unshift(response.data);
      return response.data;
    },

    async updateTemplate(id: string, updates: Partial<QRTemplateItem>) {
      const response = await useHttp<QRTemplateItem>(`${this.apiBase()}/templates/${id}`, {
        method: 'PATCH',
        body: updates,
      });
      if (!response.success) throw new Error(response.error?.message || 'Failed to update template');
      const index = this.templates.findIndex((t) => t.id === id);
      if (index !== -1) this.templates[index] = response.data;
      return response.data;
    },

    async deleteTemplate(id: string) {
      const response = await useHttp(`${this.apiBase()}/templates/${id}`, { method: 'DELETE' });
      if (!response.success) throw new Error('Failed to delete template');
      this.templates = this.templates.filter((t) => t.id !== id);
    },

    // ---------- Frames ----------
    async fetchFrames() {
      const response = await useHttp<QRFrameItem[]>(`${this.apiBase()}/frames`, { method: 'GET' });
      if (response.success) this.frames = response.data;
    },

    async addFrame(frame: Omit<QRFrameItem, 'id'>) {
      const response = await useHttp<QRFrameItem>(`${this.apiBase()}/frames`, { method: 'POST', body: frame });
      if (!response.success) throw new Error(response.error?.message || 'Failed to create frame');
      this.frames.unshift(response.data);
      return response.data;
    },

    async updateFrame(id: string, updates: Partial<QRFrameItem>) {
      const response = await useHttp<QRFrameItem>(`${this.apiBase()}/frames/${id}`, {
        method: 'PATCH',
        body: updates,
      });
      if (!response.success) throw new Error(response.error?.message || 'Failed to update frame');
      const index = this.frames.findIndex((f) => f.id === id);
      if (index !== -1) this.frames[index] = response.data;
      return response.data;
    },

    async deleteFrame(id: string) {
      const response = await useHttp(`${this.apiBase()}/frames/${id}`, { method: 'DELETE' });
      if (!response.success) throw new Error('Failed to delete frame');
      this.frames = this.frames.filter((f) => f.id !== id);
      // Backend nullifies frameId on referencing templates via onDelete:
      // SetNull — refresh local state to match rather than hand-patching it.
      await this.fetchTemplates();
    },

    // ---------- Analytics ----------
    async fetchAnalytics(
      id: string,
      type: 'link' | 'qrcode' | 'global',
      range: '7d' | '30d' | 'all' = '7d'
    ): Promise<AnalyticsData | null> {
      const path = type === 'global' ? '/analytics/global' : `/analytics/${type}s/${id}`;
      const response = await useHttp<AnalyticsData>(`${this.apiBase()}${path}?range=${range}`, { method: 'GET' });
      return response.success ? response.data : null;
    },
  },
});
