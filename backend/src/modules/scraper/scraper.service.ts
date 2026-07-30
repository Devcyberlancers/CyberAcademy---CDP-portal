import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { chromium, BrowserContext, Locator } from 'playwright';
import { PrismaService } from '../../prisma/prisma.service';

const KEYWORDS = ['Cyber Security Fresher', 'SOC Analyst Fresher', 'Junior Security Engineer'];
const CONFIG: Record<string, any> = {
  naukri: {
    name: 'Naukri', url: (q: string, l: string) => `https://www.naukri.com/${encodeURIComponent(q).replace(/%20/g, '-')}-jobs-in-${encodeURIComponent(l).replace(/%20/g, '-')}?k=${encodeURIComponent(q)}&l=${encodeURIComponent(l)}&experience=0`,
    cards: ['.srp-jobtuple-wrapper', '.jobTuple', 'article'], title: ['.title', 'a.title', 'a[title]'], company: ['.comp-name', '.subTitle'], location: ['.locWdth', '.location'], link: ['a.title', 'a[title]'],
  },
  linkedin: {
    name: 'LinkedIn', url: (q: string, l: string) => `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}&location=${encodeURIComponent(l)}&f_E=1%2C2`,
    cards: ['.base-card', '.jobs-search__results-list li'], title: ['.base-search-card__title', 'h3'], company: ['.base-search-card__subtitle', 'h4'], location: ['.job-search-card__location'], link: ['a.base-card__full-link', 'a'],
  },
  indeed: {
    name: 'Indeed', url: (q: string, l: string) => `https://www.indeed.com/jobs?q=${encodeURIComponent(q)}&l=${encodeURIComponent(l)}`,
    cards: ['.job_seen_beacon', 'td.resultContent'], title: ["[data-testid='jobTitle']", 'h2 span'], company: ["[data-testid='company-name']", '.companyName'], location: ["[data-testid='text-location']", '.companyLocation'], link: ['h2 a', 'a'],
  },
  foundit: {
    name: 'Foundit', url: (q: string, l: string) => `https://www.foundit.in/srp/results?query=${encodeURIComponent(q)}&locations=${encodeURIComponent(l)}`,
    cards: ['.cardContainer', '.jobTuple', 'article'], title: ['.jobTitle', 'h3', 'a'], company: ['.companyName', '.company-name'], location: ['.location'], link: ["a[href*='job']", 'a'],
  },
  wellfound: {
    name: 'Wellfound', url: (q: string, l: string) => `https://wellfound.com/jobs?keyword=${encodeURIComponent(q)}&location=${encodeURIComponent(l)}`,
    cards: ["[data-test='StartupResult']", 'article'], title: ["[data-test='StartupResult JobTitle']", 'h3'], company: ["[data-test='StartupResult CompanyName']", 'h2'], location: ["[data-test='StartupResult Location']", '.location'], link: ["a[href*='/jobs/']", 'a'],
  },
};

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private lastGlobal = 0;
  private running = false;
  constructor(private readonly prisma: PrismaService) {}

  private async text(card: Locator, selectors: string[]) {
    for (const selector of selectors) try {
      const item = card.locator(selector).first();
      if (await item.count()) { const value = (await item.innerText({ timeout: 900 })).replace(/\s+/g, ' ').trim(); if (value) return value; }
    } catch {
      // A selector may not exist on every job card; try the next selector.
    }
    return '';
  }
  private async href(card: Locator, selectors: string[], base: string) {
    for (const selector of selectors) try {
      const value = await card.locator(selector).first().getAttribute('href', { timeout: 900 });
      if (value) return new URL(value, base).toString();
    } catch {
      // A selector may not exist on every job card; try the next selector.
    }
    return '';
  }

  private valid(title: string, description: string) {
    const text = `${title} ${description}`.toLowerCase();
    const cyber = /(cyber|security|soc|siem|threat|incident|vapt|penetration)/.test(text);
    const entry = /(fresher|entry.level|junior|associate|graduate|trainee|0.?1|0.?2)/.test(text);
    return cyber && entry;
  }

  private async scrapePlatform(context: BrowserContext, platform: string, query: string, location: string, limit: number) {
    const config = CONFIG[platform]; const page = await context.newPage(); const jobs: any[] = [];
    try {
      const url = config.url(query, location);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
      const body = (await page.locator('body').innerText({ timeout: 3000 })).toLowerCase();
      if (/captcha|verify you are human|sign in to continue|login to continue/.test(body)) return jobs;
      let cards: Locator | undefined;
      for (const selector of config.cards) { const found = page.locator(selector); if (await found.count()) { cards = found; break; } }
      if (!cards) return jobs;
      for (let i = 0; i < Math.min(await cards.count(), limit); i++) {
        const card = cards.nth(i); const title = await this.text(card, config.title);
        const company = await this.text(card, config.company); const jobLocation = await this.text(card, config.location);
        const applyUrl = await this.href(card, config.link, url); const description = (await card.innerText({ timeout: 1200 })).replace(/\s+/g, ' ').trim();
        if (!title || !applyUrl || !this.valid(title, description)) continue;
        jobs.push({
          title, company, location: jobLocation || location, experience: 'Fresher / Entry Level',
          salary: '', employment_type: /intern/i.test(description) ? 'Internship' : 'Full Time',
          skills: 'Cybersecurity', description, posted_date: '', apply_url: applyUrl,
          company_logo: null, platform: config.name, match_score: 80, is_entry_level: true,
        });
      }
      return jobs;
    } finally { await page.close(); }
  }

  async refresh(location = 'India', platforms = Object.keys(CONFIG), limit = 6, keywords = KEYWORDS) {
    if (this.running) return { stored: 0, errors: { scheduler: 'Job refresh is already running' } };
    this.running = true; let browser; let stored = 0; const errors: Record<string, string> = {};
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ userAgent: 'Mozilla/5.0 Chrome/122 Safari/537.36', viewport: { width: 1366, height: 900 } });
      for (const keyword of keywords) {
        const results = await Promise.all(platforms.filter((p) => CONFIG[p]).map(async (platform) => {
          try { return await this.scrapePlatform(context, platform, keyword, location, limit); }
          catch (error) { errors[CONFIG[platform].name] = error instanceof Error ? error.message : String(error); return []; }
        }));
        for (const job of results.flat()) {
          const existing = await this.prisma.jobs.findFirst({ where: { apply_url: job.apply_url } });
          const now = new Date();
          if (existing) await this.prisma.jobs.update({ where: { id: existing.id }, data: { ...job, updated_at: now } });
          else await this.prisma.jobs.create({ data: { ...job, created_at: now, updated_at: now } });
          stored++;
        }
      }
      await context.close();
      return { stored, errors };
    } catch (error) {
      errors.playwright = error instanceof Error ? error.message : String(error);
      return { stored, errors };
    } finally {
      if (browser) await browser.close();
      this.running = false;
    }
  }

  @Cron('*/1 * * * *')
  async scheduledRefresh() {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const today = `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-${String(ist.getDate()).padStart(2, '0')}`;
    const time = `${String(ist.getHours()).padStart(2, '0')}:${String(ist.getMinutes()).padStart(2, '0')}`;
    const due = await this.prisma.student_job_search_preferences.findMany({
      where: { active: true, search_time_ist: { lte: time }, OR: [{ last_run_on: null }, { last_run_on: { not: today } }] },
    });
    if (!due.length && Date.now() - this.lastGlobal < 30 * 60_000) return;
    const result = await this.refresh();
    this.lastGlobal = Date.now();
    if (due.length) await this.prisma.student_job_search_preferences.updateMany({ where: { id: { in: due.map((row) => row.id) } }, data: { last_run_on: today } });
    this.logger.log(`Scheduled job refresh stored ${result.stored} jobs`);
  }
}
