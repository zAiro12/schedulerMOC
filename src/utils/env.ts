// Utility to centralize environment variables usage
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3000/api'
export const FEATURE_FLAG = (import.meta.env.VITE_FEATURE_FLAG as string) === 'true'
export const APP_NAME: string = (import.meta.env.VITE_APP_NAME as string) ?? 'Scheduler MOC'
export const APP_ENV: string =
  (import.meta.env.MODE as string) ??
  (typeof __APP_ENV__ !== 'undefined' ? (__APP_ENV__ as string) : 'development')

export default {
  API_URL,
  FEATURE_FLAG,
  APP_NAME,
  APP_ENV,
}
