const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type FetchOptions = RequestInit & { timeout?: number };

async function apiFetch(path: string, options: FetchOptions = {}): Promise<any> {
  const { timeout = 15000, ...fetchOpts } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOpts,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(fetchOpts.headers || {}),
      },
    });
    clearTimeout(id);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw { status: res.status, message: body.detail || body.message || res.statusText, body };
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') throw { status: 0, message: 'Request timeout' };
    throw err;
  }
}

export const api = {
  get: (path: string) => apiFetch(path),
  post: (path: string, body?: any) =>
    apiFetch(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: any) =>
    apiFetch(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => apiFetch(path, { method: 'DELETE' }),
};

// Auth API
export const authAPI = {
  checkPhone: (phone: string) => api.post('/api/auth/phone/check', { phone }),
  login: (phone: string, pin: string) => api.post('/api/auth/phone/login', { phone, pin }),
  register: (data: { phone: string; ime: string; prezime: string; email?: string; pin: string }) =>
    api.post('/api/auth/register', data),
  me: () => api.get('/api/auth/me'),
  logout: () => api.post('/api/auth/logout'),
  session: (sessionId: string) =>
    apiFetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-ID': sessionId },
    }),
};

// Home API
export const homeAPI = {
  activeMemberships: () => api.get('/api/memberships/active'),
  upcomingTrainings: () => api.get('/api/trainings/upcoming'),
  studioInfo: () => api.get('/api/studio-info'),
  pendingFeedback: () => api.get('/api/feedback/pending'),
  unreadNotifications: () => api.get('/api/notifications/unread'),
  activityStatus: () => api.get('/api/user/activity-status'),
  myRequests: () => api.get('/api/packages/my-requests'),
};

// Schedule API
export const scheduleAPI = {
  getSchedule: () => api.get('/api/schedule'),
  book: (data: { slot_id: string; datum: string; vrijeme: string; instruktor: string }) =>
    api.post('/api/bookings', data),
  reschedule: (trainingId: string, data: { new_slot_id: string; new_datum: string; new_vrijeme: string; new_instruktor: string }) =>
    api.post(`/api/bookings/${trainingId}/reschedule`, data),
  share: (trainingId: string) =>
    api.post('/api/trainings/share', { training_id: trainingId, generate_link: true }),
};

// Packages API
export const packagesAPI = {
  getAll: () => api.get('/api/packages'),
  myRequests: () => api.get('/api/packages/my-requests'),
  request: (packageId: string) => api.post('/api/packages/request', { package_id: packageId }),
};

// Profile API
export const profileAPI = {
  stats: () => api.get('/api/user/stats'),
};

// Training API
export const trainingAPI = {
  upcoming: () => api.get('/api/trainings/upcoming'),
  past: () => api.get('/api/trainings/past'),
  comment: (trainingId: string, komentar: string) =>
    api.post('/api/trainings/comment', { training_id: trainingId, komentar }),
};

// Weight API
export const weightAPI = {
  getAll: () => api.get('/api/weight'),
  add: (weight: number) => api.post('/api/weight', { weight }),
  remove: (entryId: string) => api.delete(`/api/weight/${entryId}`),
};

// Notifications API
export const notificationsAPI = {
  getAll: () => api.get('/api/notifications'),
  unread: () => api.get('/api/notifications/unread'),
  markRead: (id: string) => api.post(`/api/notifications/${id}/read`),
  markAllRead: () => api.post('/api/notifications/read-all'),
};

// Memberships API
export const membershipsAPI = {
  getAll: () => api.get('/api/memberships'),
};

// Feedback API
export const feedbackAPI = {
  submit: (data: { training_id: string; fizicko_stanje: number; kvalitet_treninga: number; osjecaj_napretka: number }) =>
    api.post('/api/feedback', data),
};

// Invites API
export const invitesAPI = {
  get: (inviteId: string) => api.get(`/api/invites/${inviteId}`),
  accept: (inviteId: string) => api.post(`/api/trainings/invites/${inviteId}/accept`),
};
