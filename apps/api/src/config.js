const env = (key, fallback = '') => process.env[key] ?? fallback

export const config = {
  port: Number(env('PORT', '3001')),
  publicUrl: env('PUBLIC_URL', env('WEB_ORIGIN')),
  env: env('NODE_ENV', 'development'),
  s3: {
    endpoint: env('S3_ENDPOINT', 'http://localhost:9100'),
    region: env('S3_REGION', 'us-east-1'),
    accessKey: env('S3_ACCESS_KEY', 'baobun'),
    secretKey: env('S3_SECRET_KEY', 'baobun_dev'),
    publicEndpoint: env('S3_PUBLIC_ENDPOINT', 'http://localhost:9100'),
    bucketAvatars: env('S3_BUCKET_AVATARS', 'avatars'),
    bucketTagIcons: env('S3_BUCKET_TAG_ICONS', 'tag-icons'),
    bucketCalendarFeeds: env('S3_BUCKET_CALENDAR_FEEDS', 'calendar-feeds'),
  },
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
