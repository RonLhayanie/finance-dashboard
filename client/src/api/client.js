async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // On 401 anywhere except the auth endpoints themselves, force re-login.
  // (path here excludes the leading /api, added just above - so auth calls
  // are the ones starting with /auth, e.g. /auth/login, /auth/me.)
  if (response.status === 401 && !path.startsWith('/auth')) {
    window.location.assign('/login');
    throw new Error('Not authenticated');
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
}

function toQuery(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries).toString()}`;
}

// Accounts
export const getAccounts = () => request('/accounts');
export const addAccount = (account) => request('/accounts', { method: 'POST', body: account });
export const deleteAccount = (id) => request(`/accounts/${id}`, { method: 'DELETE' });

// Sync
export const startSync = (accountId) => request(`/sync/${accountId}`, { method: 'POST' });
export const getSyncStatus = () => request('/sync/status');
export const submitOtp = (jobId, code) => request(`/sync/${jobId}/otp`, { method: 'POST', body: { code } });
export const resetSyncStatus = (accountId) => request(`/sync/${accountId}/reset`, { method: 'POST' });

// Transactions
export const getTransactions = (params) => request(`/transactions${toQuery(params)}`);

// Analytics
export const getSummary = (params) => request(`/analytics/summary${toQuery(params)}`);
export const getAnomalies = (params) => request(`/analytics/anomalies${toQuery(params)}`);
export const getMonthlyBreakdown = (params) => request(`/analytics/monthly${toQuery(params)}`);
export const getMonths = () => request('/analytics/months');
export const getInsight = () => request('/analytics/insight');
export const recomputeAnalytics = () => request('/analytics/recompute', { method: 'POST' });

// Subscriptions
export const getSubscriptions = () => request('/subscriptions');

// Chat
export const sendChat = (messages) => request('/chat', { method: 'POST', body: { messages } });

// Auth
export const login = (username, password) => request('/auth/login', { method: 'POST', body: { username, password } });
export const logout = () => request('/auth/logout', { method: 'POST' });
export const getMe = () => request('/auth/me');
export const signup = (fields) => request('/auth/signup', { method: 'POST', body: fields });
export const verifyEmail = (token) => request(`/auth/verify-email${toQuery({ token })}`);
