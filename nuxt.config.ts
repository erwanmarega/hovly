import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  modules: ['@nuxtjs/supabase', '@nuxt/eslint'],
  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      meta: [
        { name: 'theme-color', content: '#ffd02f' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Hovly' }
      ],
      link: [
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' }
      ]
    }
  },
  supabase: {
    redirect: true,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      include: ['/dashboard', '/ajouter', '/bien/**', '/profil', '/alertes', '/comparer'],
      exclude: []
    }
  },
  runtimeConfig: {
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    scrapingbeeKey: process.env.SCRAPINGBEE_API_KEY,
    cronSecret: process.env.CRON_SECRET,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
    vapidSubject: process.env.VAPID_SUBJECT,
    public: {
      // Clé publique VAPID : nécessaire côté navigateur pour s'abonner au push.
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || ''
    }
  },
  nitro: {
    externals: {
      external: [
        'playwright',
        'playwright-core',
        'playwright-extra',
        'puppeteer-extra',
        'puppeteer-extra-plugin-stealth'
      ]
    }
  },
  vite: {
    plugins: [tailwindcss()]
  }
})
