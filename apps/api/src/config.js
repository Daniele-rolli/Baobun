const env = (key, fallback = '') => process.env[key] ?? fallback

export const config = {
  port: Number(env('PORT', '3001')),
  publicUrl: env('PUBLIC_URL', env('WEB_ORIGIN')),
  env: env('NODE_ENV', 'development'),
  staticDir: env('STATIC_DIR'),
  storagePath: env('STORAGE_PATH', './data'),
  mail: {
    debug: env('MAIL_DEBUG', 'false') === 'true',
    sender: env('MAIL_SENDER', 'Baobun <no-reply@baobun.local>'),
    host: env('MAIL_HOST', ''),
    port: Number(env('MAIL_PORT', '587')),
    secure: env('MAIL_SECURE', 'false') === 'true',
    rejectSelfSigned: env('MAIL_REJECT_SELF_SIGNED', 'true') === 'true',
    user: env('MAIL_USER', ''),
    password: env('MAIL_PASSWORD', ''),
  },
}
