import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  modules: ['@nuxtjs/supabase'],
  supabase: {
    redirect: true,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      include: ['/dashboard', '/ajouter', '/bien/**', '/profil', '/alertes'],
      exclude: []
    }
  },
  runtimeConfig: {
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    scrapingbeeKey: process.env.SCRAPINGBEE_API_KEY,
    cronSecret: process.env.CRON_SECRET
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
