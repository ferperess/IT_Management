import axios from 'axios';

let csrfToken = null;
export function setCsrfToken(token) {
  csrfToken = token;
}

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.request.use(config => {
  config.withCredentials = true;
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

api.interceptors.response.use(
  r => r,
  async err => {
    const url = err.config?.url || '';
    const isPublicAuthRoute = ['/auth/login', '/auth/session', '/auth/logout'].some(path => url.includes(path));
    if (
      err.response?.status === 403
      && err.response?.data?.erro === 'Token de proteção CSRF inválido.'
      && err.config
      && !err.config._csrfRetried
    ) {
      err.config._csrfRetried = true;
      try {
        const { data } = await api.get('/auth/session');
        setCsrfToken(data.csrfToken);
        return api.request(err.config);
      } catch (sessionError) {
        if (sessionError.response?.status === 401) {
          csrfToken = null;
          window.dispatchEvent(new Event('auth:unauthorized'));
        }
        return Promise.reject(sessionError);
      }
    }
    if (err.response?.status === 401 && !isPublicAuthRoute) {
      csrfToken = null;
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(err);
  }
);

export default api;
