import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'favicon.ico',
        'icons/icon_16x16.png',
        'icons/icon_16x16@2x.png',
        'icons/icon_32x32.png',
        'icons/icon_32x32@2x.png',
        'icons/icon_128x128.png',
        'icons/icon_128x128@2x.png',
        'icons/icon_256x256.png',
        'icons/icon_256x256@2x.png',
        'icons/icon_512x512.png',
        'icons/icon_512x512@2x.png',
      ],

      manifest: {
        name: 'GroupCalendar',
        short_name: 'Baobun',
        description: 'A shared group calendar with custom tags',
        background_color: '#ffffff',
        theme_color: '#f43f5e',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icons/icon_192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon_512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,

        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          {
            // The API must always bypass cache (cookie auth)
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },

          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|woff2|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'asset-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },

      devOptions: {
        enabled: true,
      },
    }),

    tailwindcss(),
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  server: {
    host: true,
    port: 4173,
    allowedHosts: [process.env.ALLOWED_HOST || 'localhost'],
    preview: {
      host: true,
      port: 4173,
      allowedHosts: [process.env.ALLOWED_HOST || 'localhost'],
    },
  },
})
