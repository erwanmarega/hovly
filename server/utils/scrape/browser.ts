import { createRequire } from 'node:module'
import type { Browser, BrowserContext } from 'playwright'
import { isPublicHostname } from '../validation'

const require = createRequire(import.meta.url)

let chromiumExtra: any = null

function getChromium() {
  if (chromiumExtra) return chromiumExtra
  const { chromium: pwChromium } = require('playwright')
  const { addExtra } = require('playwright-extra')
  const stealth = require('puppeteer-extra-plugin-stealth')
  chromiumExtra = addExtra(pwChromium)
  chromiumExtra.use(stealth())
  return chromiumExtra
}

let browser: Browser | null = null

export async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser
  browser = (await getChromium().launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
  })) as Browser
  return browser
}

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
]

export function pickUserAgent(seed: number): string {
  return USER_AGENTS[seed % USER_AGENTS.length]
}

export function randomDelay(min = 400, max = 1200): Promise<void> {
  const ms = min + Math.floor(Math.random() * (max - min))
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Bloque toute requête réseau du contexte (navigation, redirections,
 * sous-ressources) vers un hôte privé/interne. `assertPublicHostname` seule
 * ne protège que l'URL de départ : une redirection HTTP pendant `page.goto()`
 * n'est jamais revalidée sans ce filtre au niveau réseau.
 */
export async function guardContextAgainstSsrf(context: BrowserContext): Promise<void> {
  await context.route('**/*', async (route) => {
    let hostname: string
    try {
      hostname = new URL(route.request().url()).hostname
    } catch {
      await route.abort('blockedbyclient')
      return
    }

    const isPublic = await isPublicHostname(hostname)
    if (!isPublic) {
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })
}
