import { Injectable } from '@nestjs/common';
import { chromium, BrowserContext, Locator } from 'playwright';
import { PrismaService } from '../../prisma/prisma.service';
import { resolve } from 'node:path';

const KEYWORDS = [
  'Cyber Security Fresher',
  'Cybersecurity Analyst Fresher',
  'SOC Analyst Fresher',
  'Junior Security Engineer',
  'Information Security Fresher',
  'Cybersecurity Internship',
];
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
  private readonly refreshPromises = new Map<string, Promise<{
    stored: number; created: number; updated: number; fetched: number; errors: Record<string, string>;
  }>>();
  constructor(private readonly prisma: PrismaService) {
    // The setup command keeps Chromium here, so the refresh worker does not
    // depend on a developer's or host's global Playwright cache.
    process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(process.cwd(), '.playwright');
  }

  private async saveRefreshStatus(status: Record<string, unknown>) {
    await this.prisma.admin_snapshots.upsert({
      where: { key: 'job-refresh-status' },
      create: { key: 'job-refresh-status', payload: JSON.stringify(status), updated_by: 'manual-search', updated_at: new Date() },
      update: { payload: JSON.stringify(status), updated_by: 'manual-search', updated_at: new Date() },
    });
  }

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

  async refresh(location = 'India', platforms = Object.keys(CONFIG), limit = 10, batch = '2026 A') {
    const cleanLocation = String(location || 'India').trim().slice(0, 100) || 'India';
    const cleanPlatforms = Array.from(new Set(platforms.filter((platform) => CONFIG[platform])));
    const safePlatforms = cleanPlatforms.length ? cleanPlatforms : Object.keys(CONFIG);
    const numericLimit = Number(limit);
    const safeLimit = Number.isFinite(numericLimit) ? Math.min(20, Math.max(1, Math.trunc(numericLimit))) : 10;
    const targetBatch = String(batch || '2026 A').trim().slice(0, 80) || '2026 A';
    const refreshKey = `${targetBatch}\u0000${cleanLocation}\u0000${safePlatforms.join(',')}\u0000${safeLimit}`;
    const running = this.refreshPromises.get(refreshKey);
    if (running) return running;
    const refreshPromise = this.runRefresh(cleanLocation, safePlatforms, safeLimit, targetBatch)
      .finally(() => { this.refreshPromises.delete(refreshKey); });
    this.refreshPromises.set(refreshKey, refreshPromise);
    return refreshPromise;
  }

  private async runRefresh(location: string, platforms: string[], limit: number, batch: string) {
    let browser;
    let created = 0;
    let updated = 0;
    const errors: Record<string, string> = {};
    const startedAt = new Date().toISOString();
    try {
      await this.saveRefreshStatus({ started_at: startedAt, status: 'running', location, platforms });
    } catch {
      // Job discovery must continue even if the optional admin status snapshot is unavailable.
    }
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ userAgent: 'Mozilla/5.0 Chrome/122 Safari/537.36', viewport: { width: 1366, height: 900 } });
      const tasks = KEYWORDS.flatMap((keyword) => platforms.map((platform) => ({ keyword, platform })));
      const discovered: any[][] = [];
      let taskIndex = 0;
      const workers = Array.from({ length: Math.min(5, tasks.length) }, async () => {
        while (taskIndex < tasks.length) {
          const task = tasks[taskIndex++];
          try {
            discovered.push(await this.scrapePlatform(context, task.platform, task.keyword, location, limit));
          } catch (error) {
            errors[`${CONFIG[task.platform].name}: ${task.keyword}`] = error instanceof Error ? error.message : String(error);
          }
        }
      });
      await Promise.all(workers);
      await context.close();

      const uniqueJobs = new Map<string, any>();
      discovered.flat().forEach((job) => {
        if (job.apply_url && !uniqueJobs.has(job.apply_url)) uniqueJobs.set(job.apply_url, job);
      });
      const urls = [...uniqueJobs.keys()];
      const existingRows = urls.length
        ? await this.prisma.jobs.findMany({
          where: { apply_url: { in: urls }, platform: `admin:${batch}` },
          orderBy: { id: 'asc' },
        })
        : [];
      const existingByUrl = new Map(existingRows.map((row) => [row.apply_url, row]));
      for (const job of uniqueJobs.values()) {
        job.platform = `admin:${batch}`;
        const existing = existingByUrl.get(job.apply_url);
        const now = new Date();
        if (existing) {
          await this.prisma.jobs.update({ where: { id: existing.id }, data: { ...job, updated_at: now } });
          updated++;
        } else {
          await this.prisma.jobs.create({ data: { ...job, created_at: now, updated_at: now } });
          created++;
        }
      }
      const result = { stored: created + updated, created, updated, fetched: uniqueJobs.size, errors };
      try {
        await this.saveRefreshStatus({
          started_at: startedAt, completed_at: new Date().toISOString(),
          status: Object.keys(errors).length ? 'completed_with_warnings' : 'completed',
          location, platforms, ...result,
        });
      } catch {
        // The jobs are already durable; status reporting is best effort.
      }
      return result;
    } catch (error) {
      errors.playwright = error instanceof Error ? error.message : String(error);
      const result = { stored: created + updated, created, updated, fetched: created + updated, errors };
      try {
        await this.saveRefreshStatus({
          started_at: startedAt, completed_at: new Date().toISOString(),
          status: 'failed', location, platforms, ...result,
        });
      } catch {
        // Preserve the useful error returned to the student even if status persistence fails.
      }
      return result;
    } finally {
      if (browser) await browser.close();
    }
  }
}
