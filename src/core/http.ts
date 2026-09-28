// The ONE axios instance for every HTTP call that is not Firebase (Cloudflare workers, any future API).
// Firebase talks to Google through its own SDK; everything else goes through `http`, so timeouts, headers,
// logging and (later) caching are configured here once instead of at each call site.
import axios from 'axios';

export const http = axios.create({
  timeout: 20000, // ms; override per request when needed, e.g. http.post(url, body, { timeout: 10000 })
});

// one place to log failed requests (never log request bodies or tokens)
http.interceptors.response.use(
  (res) => res,
  (err) => {
    console.warn('[http]', err.config?.method?.toUpperCase(), err.config?.url, err.response?.status ?? err.code ?? err.message);
    return Promise.reject(err);
  }
);

// join a worker base URL and a path without doubled slashes
export const workerUrl = (base: string, path = '') => String(base || '').replace(/\/+$/, '') + path;
