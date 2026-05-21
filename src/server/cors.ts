export const CORS_ORIGINS = [
  'http://127.0.0.1:5173',  // Vite dev server via IP (SAFE-08)
  'http://localhost:5173',   // Vite dev server via hostname — same machine, different CORS origin
  'http://127.0.0.1:3747',  // Production self-serve via IP
  'http://localhost:3747',   // Production self-serve via hostname
]
