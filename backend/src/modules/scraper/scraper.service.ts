import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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
const INDIA_LOCATIONS = /(india|karnataka|bengaluru|bangalore|mysuru|mysore|mangaluru|mangalore|hubballi|dharwad|belagavi|belgaum|tumakuru|udupi|shivamogga|delhi|noida|gurugram|gurgaon|mumbai|pune|hyderabad|chennai|kolkata|kochi|cochin|ahmedabad|jaipur|chandigarh|remote.*india)/i;
const KARNATAKA_LOCATIONS = /(karnataka|bengaluru|bangalore|mysuru|mysore|mangaluru|mangalore|hubballi|dharwad|belagavi|belgaum|tumakuru|udupi|shivamogga)/i;
const GREENHOUSE_BOARDS = ['cloudsek', 'razorpay', 'phonepe', 'sigmoid', 'browserstack', 'chargebee', 'freshworks'];
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
  cutshort: {
    name: 'Cutshort', url: (q: string, l: string) => `https://cutshort.io/jobs?search=${encodeURIComponent(q)}&location=${encodeURIComponent(l)}`,
    cards: ['[data-testid=job-card]', '.job-card', `a[href*='/job/']`], title: ['h2', 'h3', '[data-testid=job-title]'], company: ['[data-testid=company-name]', '.company-name'], location: ['[data-testid=job-location]', '.location'], link: [`a[href*='/job/']`, 'a'],
  },
  hirist: {
    name: 'Hirist', url: (q: string, l: string) => `https://www.hirist.tech/search?query=${encodeURIComponent(q)}&location=${encodeURIComponent(l)}`,
    cards: ['.job-card', '.job-list-item', `a[href*='/j/']`], title: ['h2', 'h3', '.job-title'], company: ['.company-name', '.company'], location: ['.location', '.job-location'], link: [`a[href*='/j/']`, 'a'],
  },
  companycareers: {
    name: 'Company Careers', url: (q: string, l: string) => `https://careers.cognizant.com/global-en/jobs/?search=${encodeURIComponent(q)}&location=${encodeURIComponent(l)}`,
    cards: ['.jobs-list-item', '.job-result', 'article', `a[href*='/jobs/']`], title: ['h2', 'h3', '.job-title'], company: ['.company-name'], location: ['.job-location', '.location'], link: [`a[href*='/jobs/']`, 'a'],
  },
  remoteok: { name: 'RemoteOK', structured: true },
  greenhouse: { name: 'Greenhouse', structured: true },
};

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly refreshPromises = new Map<string, Promise<{
    stored: number; created: number; updated: number; fetched: number; rejected_closed: number; errors: Record<string, string>;
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
    const entry = /(fresher|entry.level|junior|graduate|trainee|intern(?:ship)?|campus|new grad|0\s*(?:-|to)\s*[12]\s*years?|up to 2 years?)/.test(text);
    const senior = /(senior|lead|manager|principal|architect|staff engineer|[3-9]\+?\s*years?|[2-9]\s*(?:-|to)\s*[3-9]\s*years?)/.test(`${title} ${description.slice(0, 12_000)}`.toLowerCase());
    return cyber && entry && !senior;
  }

  private indiaLocation(location: string, description = '') {
    const text = `${location} ${description.slice(0, 3_000)}`;
    return INDIA_LOCATIONS.test(text) && !/(united states|usa|canada|europe|united kingdom|uk only|australia|singapore|germany|france)/i.test(location);
  }

  private stripHtml(value: unknown) {
    return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private async scrapeStructured(context: BrowserContext, platform: string, limit: number) {
    const jobs: any[] = [];
    if (platform === 'remoteok') {
      const response = await context.request.get('https://remoteok.com/api', { timeout: 25_000, headers: { 'User-Agent': 'CyberAcademy-Jobs/1.0' } });
      if (!response.ok()) return jobs;
      const rows = await response.json() as any[];
      for (const row of rows.slice(1)) {
        const title = String(row.position ?? '');
        const description = this.stripHtml(row.description);
        const location = String(row.location ?? 'Remote - India');
        if (!this.valid(title, description) || !this.indiaLocation(location, description)) continue;
        jobs.push({
          title, company: String(row.company ?? ''), location, experience: 'Fresher / Entry Level',
          salary: [row.salary_min, row.salary_max].filter(Boolean).join(' - '),
          employment_type: /intern/i.test(`${title} ${description}`) ? 'Internship' : 'Full Time',
          skills: Array.isArray(row.tags) ? row.tags.join(',') : 'Cybersecurity', description,
          posted_date: String(row.date ?? ''), apply_url: String(row.apply_url ?? row.url ?? ''),
          company_logo: row.company_logo || row.logo || null, platform: 'RemoteOK', match_score: 80, is_entry_level: true,
        });
        if (jobs.length >= limit) break;
      }
      return jobs;
    }
    if (platform === 'greenhouse') {
      for (const board of GREENHOUSE_BOARDS) {
        try {
          const response = await context.request.get(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, { timeout: 20_000 });
          if (!response.ok()) continue;
          const payload = await response.json() as { jobs?: any[] };
          for (const row of payload.jobs ?? []) {
            const title = String(row.title ?? '');
            const description = this.stripHtml(row.content);
            const location = String(row.location?.name ?? '');
            if (!row.internal_job_id || !this.valid(title, description) || !this.indiaLocation(location, description)) continue;
            jobs.push({
              title, company: board.replace(/[-_]/g, ' '), location, experience: 'Fresher / Entry Level',
              salary: '', employment_type: /intern/i.test(`${title} ${description}`) ? 'Internship' : 'Full Time',
              skills: 'Cybersecurity', description, posted_date: String(row.updated_at ?? ''),
              apply_url: String(row.absolute_url ?? ''), company_logo: null, platform: 'Greenhouse',
              match_score: 85, is_entry_level: true,
            });
          }
        } catch {
          // One unavailable company board must not prevent other boards from loading.
        }
      }
    }
    return jobs.slice(0, limit * GREENHOUSE_BOARDS.length);
  }

  private closedListing(text: string) {
    return /(no longer accepting applications|job (?:is )?no longer available|job (?:posting )?(?:has )?expired|position (?:has been|is) filled|applications? (?:are |is )?closed|vacancy (?:is )?closed|this job (?:has been|was) closed|not accepting (?:new )?applications)/i.test(text);
  }

  private async availability(context: BrowserContext, applyUrl: string): Promise<'open' | 'closed' | 'unknown'> {
    const page = await context.newPage();
    try {
      const response = await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 18_000 });
      const status = response?.status();
      if (status === 404 || status === 410) return 'closed';
      if (status && status >= 500) return 'unknown';
      const text = (await page.locator('body').innerText({ timeout: 4_000 })).replace(/\s+/g, ' ').slice(0, 80_000);
      return this.closedListing(text) ? 'closed' : 'open';
    } catch {
      return 'unknown';
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  private availabilityKey(jobId: number) {
    return `job-availability:${jobId}`;
  }

  private async recordAvailability(jobId: number, status: 'open' | 'closed' | 'unknown') {
    const data = {
      payload: JSON.stringify({ status, checked_at: new Date().toISOString() }),
      updated_by: 'job-availability-monitor',
      updated_at: new Date(),
    };
    await this.prisma.admin_snapshots.upsert({
      where: { key: this.availabilityKey(jobId) },
      create: { key: this.availabilityKey(jobId), ...data },
      update: data,
    });
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
        if (!title || !applyUrl || !this.valid(title, description) || !this.indiaLocation(jobLocation || location, description)) continue;
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
      const requestedLocation = String(location || '').trim();
      const locations = Array.from(new Set([
        'Karnataka',
        'Bengaluru, Karnataka',
        ...(requestedLocation && !/^(india|karnataka|bengaluru|bangalore)$/i.test(requestedLocation) ? [requestedLocation] : []),
        'India',
      ]));
      const browserPlatforms = platforms.filter((platform) => !CONFIG[platform]?.structured);
      const structuredPlatforms = platforms.filter((platform) => CONFIG[platform]?.structured);
      const tasks = locations.flatMap((searchLocation, locationPriority) =>
        KEYWORDS.flatMap((keyword) => browserPlatforms.map((platform) => ({ keyword, platform, searchLocation, locationPriority }))),
      );
      const discovered: any[][] = [];
      let taskIndex = 0;
      const workers = Array.from({ length: Math.min(5, tasks.length) }, async () => {
        while (taskIndex < tasks.length) {
          const task = tasks[taskIndex++];
          try {
            discovered.push(await this.scrapePlatform(context, task.platform, task.keyword, task.searchLocation, limit));
          } catch (error) {
            errors[`${CONFIG[task.platform].name}: ${task.keyword}`] = error instanceof Error ? error.message : String(error);
          }
        }
      });
      await Promise.all(workers);
      for (const platform of structuredPlatforms) {
        try {
          discovered.push(await this.scrapeStructured(context, platform, limit));
        } catch (error) {
          errors[CONFIG[platform].name] = error instanceof Error ? error.message : String(error);
        }
      }

      const uniqueJobs = new Map<string, any>();
      discovered.flat().forEach((job) => {
        if (!job.apply_url || !this.indiaLocation(job.location, job.description)) return;
        const existing = uniqueJobs.get(job.apply_url);
        if (!existing || (KARNATAKA_LOCATIONS.test(job.location) && !KARNATAKA_LOCATIONS.test(existing.location))) {
          uniqueJobs.set(job.apply_url, job);
        }
      });
      const candidates = [...uniqueJobs.values()].sort((left, right) =>
        Number(KARNATAKA_LOCATIONS.test(right.location)) - Number(KARNATAKA_LOCATIONS.test(left.location)));
      const availabilityResults = new Map<string, 'open' | 'closed' | 'unknown'>();
      let validationIndex = 0;
      const validationWorkers = Array.from({ length: Math.min(5, candidates.length) }, async () => {
        while (validationIndex < candidates.length) {
          const job = candidates[validationIndex++];
          availabilityResults.set(job.apply_url, await this.availability(context, job.apply_url));
        }
      });
      await Promise.all(validationWorkers);
      await context.close();
      const rejectedClosed = candidates.filter((job) => availabilityResults.get(job.apply_url) === 'closed').length;
      const applicableJobs = candidates.filter((job) => availabilityResults.get(job.apply_url) !== 'closed');
      const closedUrls = candidates
        .filter((job) => availabilityResults.get(job.apply_url) === 'closed')
        .map((job) => job.apply_url);
      if (closedUrls.length) {
        const storedClosedJobs = await this.prisma.jobs.findMany({
          where: { apply_url: { in: closedUrls }, platform: `admin:${batch}` },
          select: { id: true },
        });
        for (const storedJob of storedClosedJobs) {
          const applications = await this.prisma.applications.count({ where: { job_id: storedJob.id } });
          if (applications) {
            await this.recordAvailability(storedJob.id, 'closed');
          } else {
            await this.prisma.$transaction([
              this.prisma.admin_snapshots.deleteMany({ where: { key: this.availabilityKey(storedJob.id) } }),
              this.prisma.jobs.delete({ where: { id: storedJob.id } }),
            ]);
          }
        }
      }
      const urls = applicableJobs.map((job) => job.apply_url);
      const existingRows = urls.length
        ? await this.prisma.jobs.findMany({
          where: { apply_url: { in: urls }, platform: `admin:${batch}` },
          orderBy: { id: 'asc' },
        })
        : [];
      const existingByUrl = new Map(existingRows.map((row) => [row.apply_url, row]));
      for (const job of applicableJobs) {
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
      const result = { stored: created + updated, created, updated, fetched: uniqueJobs.size, rejected_closed: rejectedClosed, errors };
      try {
        await this.saveRefreshStatus({
          started_at: startedAt, completed_at: new Date().toISOString(),
          status: Object.keys(errors).length ? 'completed_with_warnings' : 'completed',
          location_priority: ['Karnataka', 'India'], platforms, ...result,
        });
      } catch {
        // The jobs are already durable; status reporting is best effort.
      }
      return result;
    } catch (error) {
      errors.playwright = error instanceof Error ? error.message : String(error);
      const result = { stored: created + updated, created, updated, fetched: created + updated, rejected_closed: 0, errors };
      try {
        await this.saveRefreshStatus({
          started_at: startedAt, completed_at: new Date().toISOString(),
          status: 'failed', location_priority: ['Karnataka', 'India'], platforms, ...result,
        });
      } catch {
        // Preserve the useful error returned to the student even if status persistence fails.
      }
      return result;
    } finally {
      if (browser) await browser.close();
    }
  }

  @Cron('0 30 3 */2 * *', { timeZone: 'Asia/Kolkata' })
  async removeUnavailableJobs() {
    const rows = await this.prisma.jobs.findMany({
      where: { NOT: { apply_url: '' } },
      select: { id: true, apply_url: true },
      orderBy: { id: 'asc' },
    });
    if (!rows.length) return { checked: 0, hidden: 0, removed: 0 };

    const previousChecks = await this.prisma.admin_snapshots.findMany({
      where: { key: { startsWith: 'job-availability:' } },
      select: { key: true, updated_at: true },
    });
    const checkedAt = new Map(previousChecks.map((row) => [
      Number(row.key.slice('job-availability:'.length)), row.updated_at.getTime(),
    ]));
    const candidates = rows
      .sort((left, right) => (checkedAt.get(left.id) ?? 0) - (checkedAt.get(right.id) ?? 0));

    let browser;
    let hidden = 0;
    let removed = 0;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ userAgent: 'Mozilla/5.0 Chrome/122 Safari/537.36', viewport: { width: 1366, height: 900 } });
      let index = 0;
      const workers = Array.from({ length: Math.min(4, candidates.length) }, async () => {
        while (index < candidates.length) {
          const job = candidates[index++];
          const status = await this.availability(context, job.apply_url);
          if (status !== 'closed') {
            await this.recordAvailability(job.id, status);
            continue;
          }
          const applications = await this.prisma.applications.count({ where: { job_id: job.id } });
          if (applications) {
            await this.recordAvailability(job.id, 'closed');
            hidden++;
          } else {
            await this.prisma.$transaction([
              this.prisma.admin_snapshots.deleteMany({ where: { key: this.availabilityKey(job.id) } }),
              this.prisma.jobs.delete({ where: { id: job.id } }),
            ]);
            removed++;
          }
        }
      });
      await Promise.all(workers);
      await context.close();
      return { checked: candidates.length, hidden, removed };
    } catch (error) {
      this.logger.warn(`Job availability cleanup stopped safely: ${error instanceof Error ? error.message : String(error)}`);
      return { checked: 0, hidden, removed };
    } finally {
      if (browser) await browser.close().catch(() => undefined);
    }
  }
}
