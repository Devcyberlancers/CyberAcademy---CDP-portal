import {
  ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, users_role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  AccessDto, CourseDto, CredentialSendDto, JobCreateDto, PortalSettingsDto,
  SnapshotDto, StudentAccountDto, StudentCourseDto, StudentReminderDto,
  LegacyStudentLoginDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  private settings: PortalSettingsDto = new PortalSettingsDto();
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private normalizeBatch(value?: string) {
    const normalized = value?.trim().replace(/\s+/g, ' ') ?? '';
    return /^\d{4}\s+[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(normalized) ? normalized : undefined;
  }

  private batchSelectionKey(actor: string) {
    return `admin-batch-selection:${actor.trim().toLowerCase()}`.slice(0, 180);
  }

  private async batchEmails(batch?: string) {
    const selected = this.normalizeBatch(batch);
    if (!selected) return undefined;
    const profiles = await this.prisma.student_profiles.findMany({ where: { batch: selected }, select: { email: true } });
    return profiles.map((profile) => profile.email.toLowerCase());
  }

  async batchContext(actor: string) {
    const [catalogRow, selectionRow, grouped] = await Promise.all([
      this.prisma.admin_snapshots.findUnique({ where: { key: 'admin-batch-catalog-v1' } }),
      this.prisma.admin_snapshots.findUnique({ where: { key: this.batchSelectionKey(actor) } }),
      this.prisma.student_profiles.groupBy({ by: ['batch'], _count: { _all: true }, orderBy: { batch: 'asc' } }),
    ]);
    let catalog: Array<{ name: string; created_at?: string; created_by?: string }> = [];
    let selected = '';
    try { const value = catalogRow ? JSON.parse(catalogRow.payload) : []; catalog = Array.isArray(value) ? value : []; } catch { catalog = []; }
    try { selected = selectionRow ? String(JSON.parse(selectionRow.payload)?.batch ?? '') : ''; } catch { selected = ''; }
    const counts = new Map(grouped.filter((item) => Boolean(item.batch)).map((item) => [item.batch, item._count._all]));
    const names = new Set(['2026 A', ...catalog.map((item) => item.name), ...counts.keys()]);
    const batches = [...names].filter((name) => this.normalizeBatch(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((name) => {
      const saved = catalog.find((item) => item.name === name);
      return { name, student_count: counts.get(name) ?? 0, created_at: saved?.created_at ?? null, created_by: saved?.created_by ?? null };
    });
    if (!names.has(selected)) selected = names.has('2026 A') ? '2026 A' : batches[0]?.name ?? '';
    return { selected_batch: selected, batches };
  }

  async createBatch(name: string, actor: string) {
    const normalized = this.normalizeBatch(name);
    if (!normalized) throw new UnprocessableEntityException('Batch must start with a four-digit year followed by a label, for example 2026 A');
    const row = await this.prisma.admin_snapshots.findUnique({ where: { key: 'admin-batch-catalog-v1' } });
    let catalog: Array<{ name: string; created_at: string; created_by: string }> = [];
    try { const value = row ? JSON.parse(row.payload) : []; catalog = Array.isArray(value) ? value : []; } catch { catalog = []; }
    if (!catalog.some((item) => item.name.toLowerCase() === normalized.toLowerCase())) {
      catalog.push({ name: normalized, created_at: new Date().toISOString(), created_by: actor });
      await this.prisma.admin_snapshots.upsert({
        where: { key: 'admin-batch-catalog-v1' },
        create: { key: 'admin-batch-catalog-v1', payload: JSON.stringify(catalog), updated_by: actor, updated_at: new Date() },
        update: { payload: JSON.stringify(catalog), updated_by: actor, updated_at: new Date() },
      });
    }
    await this.selectBatch(normalized, actor);
    return this.batchContext(actor);
  }

  async selectBatch(name: string, actor: string) {
    const normalized = this.normalizeBatch(name);
    if (!normalized) throw new UnprocessableEntityException('Invalid batch name');
    const context = await this.batchContext(actor);
    if (!context.batches.some((batch) => batch.name === normalized)) throw new NotFoundException('Batch not found');
    await this.prisma.admin_snapshots.upsert({
      where: { key: this.batchSelectionKey(actor) },
      create: { key: this.batchSelectionKey(actor), payload: JSON.stringify({ batch: normalized }), updated_by: actor, updated_at: new Date() },
      update: { payload: JSON.stringify({ batch: normalized }), updated_by: actor, updated_at: new Date() },
    });
    return { selected_batch: normalized };
  }

  private accessOut(row: any) {
    return {
      courses_enabled: Boolean(row?.courses_enabled),
      assessments_enabled: Boolean(row?.assessments_enabled),
      jobs_enabled: Boolean(row?.jobs_enabled),
    };
  }

  private globalAccess(batch?: string) {
    const selected = this.normalizeBatch(batch);
    const scopeKey = selected ? `global:batch:${selected.toLowerCase()}` : 'global';
    return this.prisma.portal_access_settings.upsert({
      where: { scope_key: scopeKey },
      create: {
        scope_key: scopeKey, courses_enabled: false, assessments_enabled: false,
        jobs_enabled: false, updated_by: '', updated_at: new Date(),
      },
      update: {},
    });
  }

  async getGlobalAccess(batch?: string) { return this.accessOut(await this.globalAccess(batch)); }

  async setGlobalAccess(dto: AccessDto, actor: string, batch?: string) {
    const selected = this.normalizeBatch(batch);
    const scopeKey = selected ? `global:batch:${selected.toLowerCase()}` : 'global';
    const emails = await this.batchEmails(batch);
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.portal_access_settings.upsert({
        where: { scope_key: scopeKey },
        create: { scope_key: scopeKey, ...dto, updated_by: actor, updated_at: new Date() },
        update: { ...dto, updated_by: actor, updated_at: new Date() },
      });
      await tx.portal_access_settings.updateMany({
        where: selected ? { scope_key: { in: emails ?? [] } } : { scope_key: { not: 'global' } },
        data: { ...dto, updated_by: actor, updated_at: new Date() },
      });
      return updated;
    });
    return this.accessOut(row);
  }

  async getStudentAccess(studentId: number) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { id: studentId } });
    if (!profile) throw new NotFoundException('Student not found');
    const row = await this.prisma.portal_access_settings.findUnique({ where: { scope_key: profile.email.toLowerCase() } })
      ?? await this.globalAccess();
    return this.accessOut(row);
  }

  async setStudentAccess(studentId: number, dto: AccessDto, actor: string) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { id: studentId } });
    if (!profile) throw new NotFoundException('Student not found');
    const row = await this.prisma.portal_access_settings.upsert({
      where: { scope_key: profile.email.toLowerCase() },
      create: { scope_key: profile.email.toLowerCase(), ...dto, updated_by: actor, updated_at: new Date() },
      update: { ...dto, updated_by: actor, updated_at: new Date() },
    });
    return this.accessOut(row);
  }

  private courseOut(course: any) {
    const metadata = (course.metadata_json && typeof course.metadata_json === 'object') ? course.metadata_json : {};
    return {
      id: course.id, title: course.title, category: course.category,
      instructor: metadata.instructor ?? '', level: course.level, status: course.status,
      visibility: metadata.visibility ?? 'public', duration: metadata.duration ?? '',
      progress_percent: course.progress_percent, assessments: course.assessments,
      heading: course.heading, labs: course.labs, start_date: course.start_date,
      end_date: course.end_date, icon: course.icon, color: course.color,
      metadata, updated_at: course.updated_at,
    };
  }

  async courses(batch?: string) {
    const rows = await this.prisma.courses.findMany({ orderBy: { updated_at: 'desc' } });
    const selected = this.normalizeBatch(batch);
    return rows.filter((row) => !selected || (row.metadata_json as any)?.target_batch === selected).map((row) => this.courseOut(row));
  }

  async courseOverview(batch?: string) {
    const selected = this.normalizeBatch(batch);
    const rows = await this.prisma.courses.findMany({ select: { status: true, metadata_json: true } });
    const scoped = rows.filter((row) => !selected || (row.metadata_json as any)?.target_batch === selected);
    const total = scoped.length;
    const published = scoped.filter((row) => ['active', 'published'].includes(row.status)).length;
    const drafts = scoped.filter((row) => row.status === 'draft').length;
    return { section: 'courses', summary: { total_courses: total, published, drafts } };
  }

  async courseStudents(courseId: number, batch?: string) {
    const course = await this.prisma.courses.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    const prefix = `course:${courseId}:`;
    const [profiles, academics, settings, attempts, moduleSnapshot] = await Promise.all([
      this.prisma.student_profiles.findMany({ where: this.normalizeBatch(batch) ? { batch: this.normalizeBatch(batch) } : {}, orderBy: { full_name: 'asc' } }),
      this.prisma.students.findMany({
        include: {
          users: { select: { email: true } },
          student_course_assignments: { where: { course_id: courseId } },
        },
      }),
      this.prisma.assignment_security_settings.findMany({
        where: { assignment_id: { startsWith: prefix }, published: true, active: true },
        select: { assignment_id: true },
      }),
      this.prisma.assignment_attempts.findMany({
        where: { assignment_id: { startsWith: prefix } },
        orderBy: { started_at: 'desc' },
      }),
      this.prisma.admin_snapshots.findUnique({ where: { key: `course-editor-modules-${courseId}-v2` } }),
    ]);
    let moduleDefinitions: Array<{ generatedQuestions?: unknown[] }> = [];
    try {
      const parsed = moduleSnapshot ? JSON.parse(moduleSnapshot.payload) : [];
      moduleDefinitions = Array.isArray(parsed) ? parsed : [];
    } catch { moduleDefinitions = []; }
    const totalModules = moduleDefinitions.length;
    const progressSnapshots = await this.prisma.admin_snapshots.findMany({ where: { key: { startsWith: `course-progress:${courseId}:` } } });
    const progressByEmail = new Map(progressSnapshots.map((snapshot) => {
      try { return [snapshot.key.slice(`course-progress:${courseId}:`.length), JSON.parse(snapshot.payload) as { videos?: number[]; quizzes?: Record<string, { passed?: boolean; score?: number; submitted_at?: string; attempts?: Array<{ score?: number; endedAt?: string; startedAt?: string; status?: string; violations?: number; violationReason?: string }> }> }]; }
      catch { return [snapshot.key.slice(`course-progress:${courseId}:`.length), {}]; }
    }));
    const academicByEmail = new Map(academics.map((student) => [student.users.email.toLowerCase(), student]));
    const totalAssessments = settings.length;
    const rows = profiles.map((profile) => {
      const email = profile.email.toLowerCase();
      const academic = academicByEmail.get(email);
      const studentAttempts = attempts.filter((attempt) =>
        attempt.student_email.toLowerCase() === email || Boolean(academic && attempt.student_id === academic.id));
      const completed = studentAttempts.filter((attempt) => attempt.status !== 'in_progress');
      const completedAssessments = new Set(completed.map((attempt) => attempt.assignment_id)).size;
      const progress = progressByEmail.get(email);
      const completedModules = totalModules
        ? moduleDefinitions.map((moduleItem, index) => {
          const hasTest = Array.isArray(moduleItem.generatedQuestions) && moduleItem.generatedQuestions.length > 0;
          return hasTest ? Boolean(progress?.quizzes?.[String(index)]?.passed) : true;
        }).filter(Boolean).length
        : 0;
      const moduleAttempts = Object.values(progress?.quizzes ?? {}).flatMap((quiz) =>
        quiz.attempts?.length ? quiz.attempts : quiz.submitted_at ? [{ score: quiz.score, endedAt: quiz.submitted_at }] : []);
      const scoredAttempts = [
        ...completed.map((attempt) => ({ score: attempt.score, date: attempt.ended_at ?? attempt.started_at })),
        ...moduleAttempts.map((attempt) => ({ score: Number(attempt.score) || 0, date: new Date(attempt.endedAt ?? attempt.startedAt ?? 0) })),
      ].sort((left, right) => right.date.getTime() - left.date.getTime());
      return {
        student_id: profile.id,
        student_name: profile.full_name || profile.first_name || profile.email,
        student_email: profile.email,
        register_number: profile.registration_number,
        assigned: Boolean(academic?.student_course_assignments.length),
        progress_percent: totalModules
          ? Math.round((completedModules / totalModules) * 100)
          : totalAssessments
            ? Math.round((completedAssessments / totalAssessments) * 100)
          : 0,
        assessments_completed: completedModules || completedAssessments,
        total_assessments: totalModules || totalAssessments,
        attempts: studentAttempts.length + moduleAttempts.length,
        violations: completed.reduce((sum, attempt) => sum + (attempt.violations ?? 0), 0)
          + moduleAttempts.reduce((sum, attempt) => sum + (Number(attempt.violations) || 0), 0),
        average_score: scoredAttempts.length
          ? Math.round(scoredAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / scoredAttempts.length)
          : null,
        latest_score: scoredAttempts[0]?.score ?? null,
        latest_activity: scoredAttempts[0]?.date ?? null,
      };
    });
    return { course: this.courseOut(course), total: rows.length, students: rows };
  }

  async createCourse(dto: CourseDto, batch?: string) {
    const title = dto.title.trim();
    if (await this.prisma.courses.findUnique({ where: { title } })) {
      throw new ConflictException('A course with this title already exists');
    }
    const now = new Date();
    const heading = dto.short_description ?? dto.heading ?? '';
    const selectedBatch = this.normalizeBatch(batch) ?? '2026 A';
    const metadata: Prisma.InputJsonValue = { ...(dto.metadata ?? {
      description: dto.description ?? '', short_description: dto.short_description,
      instructor: dto.instructor, duration: dto.duration ?? '', language: dto.language,
      banner_url: dto.banner_url ?? '', visibility: dto.visibility,
    }), target_batch: selectedBatch };
    const row = await this.prisma.courses.create({
      data: {
        title, heading: heading.trim() || title, category: dto.category.trim(),
        level: dto.level.trim() || 'Beginner', status: dto.status ?? 'draft', progress_percent: dto.progress_percent ?? 0,
        assessments: dto.assessments ?? 0, labs: dto.labs ?? 0, start_date: dto.start_date ? new Date(dto.start_date) : null,
        end_date: dto.end_date ? new Date(dto.end_date) : null, icon: dto.icon ?? 'book', color: dto.color ?? 'blue',
        metadata_json: metadata, created_at: now, updated_at: now,
        admin_course_modules: {
          create: dto.modules.map((module) => ({
            title: module.title.trim(), position: module.position,
            admin_course_lessons: { create: module.lessons.map((lesson) => ({ ...lesson, title: lesson.title.trim() })) },
          })),
        },
      },
    });
    return this.courseOut(row);
  }

  async setCourseStatus(courseId: number, status: 'active' | 'draft') {
    const course = await this.prisma.courses.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    const published = status === 'active';
    await this.prisma.$transaction([
      this.prisma.courses.update({
        where: { id: courseId },
        data: { status, updated_at: new Date(), start_date: published && !course.start_date ? new Date() : undefined },
      }),
      this.prisma.assignment_security_settings.updateMany({
        where: { assignment_id: { startsWith: `course:${courseId}:` } },
        data: { published, active: published, updated_at: new Date() },
      }),
    ]);
    return { course_id: courseId, status };
  }

  async updateCourse(courseId: number, dto: CourseDto, batch?: string) {
    const current = await this.prisma.courses.findUnique({ where: { id: courseId } });
    if (!current) throw new NotFoundException('Course not found');
    const title = dto.title.trim();
    const duplicate = await this.prisma.courses.findFirst({ where: { title, id: { not: courseId } } });
    if (duplicate) throw new ConflictException('A course with this title already exists');
    const old = (current.metadata_json && typeof current.metadata_json === 'object' && !Array.isArray(current.metadata_json))
      ? current.metadata_json as Prisma.JsonObject : {};
    const heading = dto.short_description ?? dto.heading ?? current.heading;
    const metadata: Prisma.InputJsonValue = { ...(dto.metadata ?? {
      ...old, description: dto.description ?? '', short_description: dto.short_description,
      instructor: dto.instructor, duration: dto.duration ?? '', visibility: dto.visibility,
    }), target_batch: this.normalizeBatch(batch) ?? String(old.target_batch ?? '2026 A') };
    const row = await this.prisma.courses.update({
      where: { id: courseId },
      data: {
        title, heading: heading.trim(), category: dto.category.trim(),
        level: dto.level.trim() || 'Beginner', metadata_json: metadata, updated_at: new Date(),
      },
    });
    return this.courseOut(row);
  }

  async deleteCourse(courseId: number) {
    if (!await this.prisma.courses.findUnique({ where: { id: courseId } })) throw new NotFoundException('Course not found');
    await this.prisma.courses.delete({ where: { id: courseId } });
    return { deleted: true };
  }

  async dashboard(batch?: string) {
    const selectedBatch = this.normalizeBatch(batch);
    const profileWhere = selectedBatch ? { batch: selectedBatch } : {};
    const [totalStudents, openJobs, publishedCourses, approvals] = await Promise.all([
      this.prisma.student_profiles.count({ where: profileWhere }),
      this.prisma.jobs.count(),
      this.prisma.courses.count(),
      this.prisma.student_profiles.count({ where: { ...profileWhere, status: { in: ['Completed', 'Approval Pending by Admin'] } } }),
    ]);
    return {
      section: 'dashboard',
      stats: {
        total_students: totalStudents, active_this_week: Math.min(totalStudents, 8),
        courses_published: publishedCourses, pending_approvals: approvals,
        open_jobs: openJobs, security_alerts: 0,
      },
      notifications: [
        { type: 'profile_approval', count: approvals, message: 'Student profiles waiting for admin approval' },
        { type: 'course_assessment', count: publishedCourses, message: 'Course assessments are synced per course' },
      ],
      links: {
        courses: '/api/admin/courses', jobs: '/api/admin/jobs', students: '/api/admin/students',
        settings: '/api/admin/settings', nerd: '/api/admin/nerd', ide: '/api/admin/ide',
      },
    };
  }

  async dashboardStats(batch?: string) {
    const data = await this.dashboard(batch);
    return {
      total_students: data.stats.total_students, active_this_week: data.stats.active_this_week,
      courses_published: data.stats.courses_published, pending_job_approvals: 0,
      open_jobs: data.stats.open_jobs, security_alerts: 0,
    };
  }

  async dashboardActivity(batch?: string) {
    const emails = await this.batchEmails(batch);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const counts: number[] = [];
    for (let offset = 6; offset >= 0; offset--) {
      const start = new Date(today.getTime() - offset * 86_400_000);
      const end = new Date(start.getTime() + 86_400_000);
      counts.push(await this.prisma.applications.count({
        where: { status: 'applied', applied_at: { gte: start, lt: end }, ...(emails ? { students: { users: { email: { in: emails } } } } : {}) },
      }));
    }
    const peak = Math.max(0, ...counts);
    return { student_activity: counts.map((value) => peak ? Math.round(value / peak * 100) : 0), application_counts: counts };
  }

  getSettings() { return this.settings; }
  setSettings(dto: PortalSettingsDto) { this.settings = dto; return this.settings; }
  settingsOverview() {
    return {
      section: 'settings', settings: this.settings,
      endpoints: { get: '/api/admin/settings', update: '/api/admin/settings' },
      integration_notes: [
        'Use allowed domains before account creation and profile approval.',
        'Use manual_job_approval_required to control candidate approval flow.',
      ],
    };
  }

  async snapshot(key: string) {
    const row = await this.prisma.admin_snapshots.findUnique({ where: { key } });
    if (!row) throw new NotFoundException('Snapshot not found');
    return { key: row.key, payload: JSON.parse(row.payload), updated_at: row.updated_at };
  }

  async saveSnapshot(key: string, dto: SnapshotDto, actor: string) {
    await this.prisma.admin_snapshots.upsert({
      where: { key },
      create: { key, payload: JSON.stringify(dto.payload), updated_by: dto.updated_by ?? actor, updated_at: new Date() },
      update: { payload: JSON.stringify(dto.payload), updated_by: dto.updated_by ?? actor, updated_at: new Date() },
    });
    return { key, saved: true };
  }

  reports() {
    return [
      { key: 'student-progress', name: 'Student progress report' },
      { key: 'course-completion', name: 'Course completion report' },
      { key: 'placement-approvals', name: 'Placement approval report' },
      { key: 'security-audit', name: 'Security audit report' },
    ];
  }

  async securityEvents() {
    const rows = await this.prisma.assignment_events.findMany({ orderBy: { created_at: 'desc' }, take: 100 });
    return rows.map((row) => ({
      title: row.reason || row.event_type, severity: row.event_type.includes('terminate') ? 'high' : 'medium',
      actor: `attempt:${row.attempt_id}`, time: row.created_at.toISOString(),
    }));
  }

  async auditLogs() {
    const rows = await this.prisma.audit_logs.findMany({ orderBy: { created_at: 'desc' }, take: 100 });
    return rows.map((row) => ({
      actor: row.actor_email, action: row.action,
      target: [row.target_type, row.target_id].filter(Boolean).join(':'), time: row.created_at.toISOString(),
    }));
  }

  private adminJobOut(job: any) {
    return {
      id: job.id, job_id: job.id, ok: true, company: job.company, role: job.title, title: job.title,
      location: job.location, ctc: job.salary, salary: job.salary, status: 'published',
      experience: job.experience, employment_type: job.employment_type,
      skills: String(job.skills ?? '').split(',').map((value) => value.trim()).filter(Boolean),
      description: job.description, posted_date: job.posted_date, apply_url: job.apply_url,
      company_logo: job.company_logo, platform: job.platform, match_score: job.match_score,
      is_entry_level: job.is_entry_level, updated_at: job.updated_at,
    };
  }

  async adminJobs(batch?: string) {
    const rows = await this.prisma.jobs.findMany({ orderBy: { updated_at: 'desc' } });
    const selected = this.normalizeBatch(batch);
    return rows.filter((row) => !selected || row.platform === `admin:${selected}`).map((row) => this.adminJobOut(row));
  }

  async jobsOverview(batch?: string) {
    const emails = await this.batchEmails(batch);
    const [total, waiting, refreshStatus] = await Promise.all([
      this.prisma.jobs.count(),
      this.prisma.applications.count({ where: { status: 'manual_review', ...(emails ? { students: { users: { email: { in: emails } } } } : {}) } }),
      this.prisma.admin_snapshots.findUnique({ where: { key: 'job-refresh-status' } }),
    ]);
    let latest_refresh: Record<string, unknown> | null = null;
    if (refreshStatus) {
      try { latest_refresh = JSON.parse(refreshStatus.payload) as Record<string, unknown>; } catch { latest_refresh = null; }
    }
    return {
      section: 'jobs',
      summary: { total_jobs: total, published: total, candidate_waiting_approval: waiting },
      latest_refresh,
    };
  }

  async applicationActivity(batch?: string) {
    const emails = await this.batchEmails(batch);
    const rows = await this.prisma.applications.findMany({
      where: { status: 'applied', ...(emails ? { students: { users: { email: { in: emails } } } } : {}) },
      include: { students: { include: { users: true } }, jobs: true },
      orderBy: { applied_at: 'desc' },
      take: 1000,
    });
    return rows.map((row) => ({
      id: row.id, studentId: row.students.id, studentName: row.students.full_name,
      studentEmail: row.students.users.email, registrationNumber: row.students.usn,
      jobId: row.jobs.id, jobTitle: row.jobs.title, company: row.jobs.company,
      status: row.status, changedAt: row.applied_at.toISOString(),
    }));
  }

  async createJob(dto: JobCreateDto, batch?: string) {
    const now = new Date();
    const title = (dto.role ?? dto.title ?? '').trim();
    if (!title) throw new UnprocessableEntityException('Job role or title is required');
    const row = await this.prisma.jobs.create({
      data: {
        title, company: dto.company.trim(), location: dto.location ?? '',
        experience: dto.experience ?? '', salary: dto.ctc ?? dto.salary ?? '',
        employment_type: dto.job_type ?? dto.employment_type ?? '',
        skills: dto.skills?.join(', ') ?? '', description: dto.eligibility ?? dto.description ?? '',
        posted_date: dto.deadline ?? dto.posted_date ?? '', apply_url: dto.source_url ?? dto.apply_url ?? '',
        company_logo: dto.company_logo ?? null, platform: `admin:${this.normalizeBatch(batch) ?? '2026 A'}`,
        match_score: dto.match_score ?? 0, is_entry_level: dto.is_entry_level ?? true,
        created_at: now, updated_at: now,
      },
    });
    return this.adminJobOut(row);
  }

  async decideApplication(id: number, status: 'approved' | 'rejected', note?: string) {
    if (!await this.prisma.applications.findUnique({ where: { id } })) throw new NotFoundException('Application not found');
    await this.prisma.applications.update({ where: { id }, data: { status } });
    return { application_id: id, status, review_note: note ?? null };
  }

  scrapeJobs(sourceUrls: string[]) {
    const jobs = new Map<string, object>();
    sourceUrls.forEach((source_url) => {
      const item = { company: 'Sample Company', role: 'Software Engineer', location: 'Bangalore', ctc: 'Rs 6L PA', source_url };
      jobs.set(`${item.company}|${item.role}|${item.location}`, item);
    });
    return { jobs: [...jobs.values()] };
  }

  private async profileResponse(profile: any) {
    const email = profile.email.toLowerCase();
    const [user, progressRows, moduleRows, lastLoginRow] = await Promise.all([
      this.prisma.users.findUnique({ where: { email } }),
      this.prisma.admin_snapshots.findMany({ where: { key: { endsWith: `:${email}` } } }),
      this.prisma.admin_snapshots.findMany({ where: { key: { startsWith: 'course-editor-modules-' } } }),
      this.prisma.admin_snapshots.findUnique({ where: { key: `last-login:${email}` } }),
    ]);
    const modulesByCourse = new Map<number, Array<{ title?: string; generatedQuestions?: unknown[] }>>();
    for (const row of moduleRows) {
      const match = /^course-editor-modules-(\d+)-v2$/.exec(row.key);
      if (!match) continue;
      try { const modules = JSON.parse(row.payload); if (Array.isArray(modules)) modulesByCourse.set(Number(match[1]), modules); } catch { /* malformed snapshot */ }
    }
    const courseProgress: Array<{ percent: number; currentModule?: string }> = [];
    for (const row of progressRows) {
      const match = /^course-progress:(\d+):/.exec(row.key);
      if (!match) continue;
      try {
        const modules = modulesByCourse.get(Number(match[1])) ?? [];
        const saved = JSON.parse(row.payload) as { videos?: number[]; quizzes?: Record<string, { passed?: boolean }> };
        const complete = modules.map((moduleItem, index) => Array.isArray(moduleItem.generatedQuestions) && moduleItem.generatedQuestions.length > 0 ? Boolean(saved.quizzes?.[String(index)]?.passed) : true);
        const nextIndex = complete.findIndex((done) => !done);
        courseProgress.push({ percent: modules.length ? Math.round((complete.filter(Boolean).length / modules.length) * 100) : 0, currentModule: nextIndex >= 0 ? modules[nextIndex]?.title : modules.at(-1)?.title });
      } catch { /* malformed progress snapshot */ }
    }
    const progressPercent = courseProgress.length ? Math.round(courseProgress.reduce((sum, item) => sum + item.percent, 0) / courseProgress.length) : 0;
    const currentModule = courseProgress.find((item) => item.currentModule)?.currentModule ?? profile.tag ?? null;
    const sender = this.config.get<string>('smtp.fromEmail') ?? '';
    let education_summary: Array<{ level: string; year_from: string; year_to: string; score: string }> = [];
    try {
      const education = JSON.parse(profile.education_json || '[]');
      if (Array.isArray(education)) education_summary = education
        .map((item) => ({ level: String(item.level), year_from: String(item.yearFrom || ''), year_to: String(item.yearTo || ''), score: String(item.score || '') }));
    } catch { /* malformed student education is ignored in the admin summary */ }
    return {
      id: profile.id, name: profile.full_name || profile.first_name || profile.email,
      email: profile.email, register_number: profile.registration_number || profile.cyberlancers_id || String(profile.id), cyberlancers_id: profile.cyberlancers_id || null, tag: profile.tag || null,
      phone: profile.phone || null, degree: profile.course || null, branch: profile.department || null,
      batch: profile.batch || null, status: profile.status || (!user || user.is_active ? 'active' : 'suspended'),
      progress_percent: progressPercent, current_module: currentModule, payment_status: null,
      account_status: user ? 'Account Created' : 'Not Created',
      profile_status: profile.status || 'Waiting for Student', username: profile.email,
      portal_link: `${this.config.get<string>('studentFrontendUrl')?.replace(/\/+$/, '')}/student/login`,
      credential_email: profile.email, sender_email: sender, company_email: sender,
      credential_email_sent: false, credential_delivery_message: null,
      portfolio_url: profile.portfolio_url || '', photo_data_url: profile.photo_data_url || null, education_summary, education_details: (() => { try { const value = JSON.parse(profile.education_json || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } })(),
      resume_url: profile.resume_url || '', resume_file_name: profile.resume_file_name || '', resume_data_url: profile.resume_data_url || null,
      gender: profile.gender || '', date_of_birth: profile.date_of_birth || '', personal_email: profile.personal_email || '', college: profile.college || '', mentor_name: profile.mentor_name || '',
      updated_at: profile.updated_at instanceof Date ? profile.updated_at.toISOString() : String(profile.updated_at || ''),
      last_login: (() => { try { return lastLoginRow ? JSON.parse(lastLoginRow.payload)?.at || lastLoginRow.updated_at.toISOString() : null; } catch { return lastLoginRow?.updated_at.toISOString() || null; } })(),
    };
  }

  async students(batch?: string) {
    const selectedBatch = this.normalizeBatch(batch);
    const rows = await this.prisma.student_profiles.findMany({ where: selectedBatch ? { batch: selectedBatch } : {}, orderBy: [{ updated_at: 'desc' }, { id: 'desc' }] });
    return Promise.all(rows.map(async (row) => { const profile = await this.profileResponse(row); const { resume_data_url: omittedResume, education_details: omittedEducation, ...summary } = profile; void omittedResume; void omittedEducation; return summary; }));
  }

  async studentProfile(id: number, batch?: string) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Student not found');
    const selectedBatch = this.normalizeBatch(batch);
    if (selectedBatch && profile.batch !== selectedBatch) throw new NotFoundException('Student not found in selected batch');
    return this.profileResponse(profile);
  }

  async studentLearning(id: number, batch?: string) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Student not found');
    const selectedBatch = this.normalizeBatch(batch);
    if (selectedBatch && profile.batch !== selectedBatch) throw new NotFoundException('Student not found in selected batch');
    const academic = await this.prisma.students.findFirst({ where: { users: { email: profile.email.toLowerCase() } } });
    const [publishedCourses, assignments, settings, attempts, moduleRows, progressRows] = await Promise.all([
      this.prisma.courses.findMany({
        where: { status: { in: ['active', 'published'] } },
        orderBy: { updated_at: 'desc' },
      }),
      academic
        ? this.prisma.student_course_assignments.findMany({ where: { student_id: academic.id }, orderBy: { assigned_at: 'desc' } })
        : Promise.resolve([]),
      this.prisma.assignment_security_settings.findMany({
        where: { published: true, active: true },
        orderBy: { updated_at: 'desc' },
      }),
      this.prisma.assignment_attempts.findMany({
        where: {
          OR: [
            { student_email: profile.email.toLowerCase() },
            ...(academic ? [{ student_id: academic.id }] : []),
          ],
        },
        include: { assignment_events: { orderBy: { created_at: 'asc' } } },
        orderBy: [{ started_at: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.admin_snapshots.findMany({ where: { key: { startsWith: 'course-editor-modules-' } } }),
      this.prisma.admin_snapshots.findMany({ where: { key: { endsWith: `:${profile.email.toLowerCase()}` } } }),
    ]);
    const moduleDefinitions = new Map<number, Array<Record<string, any>>>();
    for (const row of moduleRows) {
      const match = /^course-editor-modules-(\d+)-v2$/.exec(row.key);
      if (!match) continue;
      try { const modules = JSON.parse(row.payload); if (Array.isArray(modules)) moduleDefinitions.set(Number(match[1]), modules); } catch { /* malformed snapshot */ }
    }
    const moduleProgress = new Map<number, number>();
    const moduleAssessments = new Map<number, any[]>();
    for (const row of progressRows) {
      const match = /^course-progress:(\d+):/.exec(row.key);
      if (!match) continue;
      try {
        const courseId = Number(match[1]);
        const saved = JSON.parse(row.payload) as { quizzes?: Record<string, { passed?: boolean; score?: number; submitted_at?: string; attempts?: any[] }> };
        const definitions = moduleDefinitions.get(courseId) ?? [];
        const completed = definitions.filter((moduleItem, index) => Array.isArray(moduleItem.generatedQuestions) && moduleItem.generatedQuestions.length > 0 ? Boolean(saved.quizzes?.[String(index)]?.passed) : true).length;
        moduleProgress.set(courseId, definitions.length ? Math.round((completed / definitions.length) * 100) : 0);
        moduleAssessments.set(courseId, definitions.flatMap((moduleItem, index) => {
          const questions = Array.isArray(moduleItem.generatedQuestions) ? moduleItem.generatedQuestions : [];
          if (!questions.length) return [];
          const quiz = saved.quizzes?.[String(index)];
          const rawAttempts = quiz?.attempts?.length ? quiz.attempts : quiz?.submitted_at ? [{ attemptNumber: 1, score: quiz.score, startedAt: quiz.submitted_at, endedAt: quiz.submitted_at, status: 'completed' }] : [];
          const attempts = rawAttempts.map((attempt: any, attemptIndex: number) => ({
            attempt_id: `module-${courseId}-${index}-${attempt.attemptNumber ?? attemptIndex + 1}`,
            assessment_id: `module:${index}`,
            assessment_title: String(moduleItem.quiz || moduleItem.title || `Module ${index + 1} Test`),
            attempt_number: Number(attempt.attemptNumber) || attemptIndex + 1,
            max_attempts: Math.max(1, Number(moduleItem.maxAttempts) || 3),
            duration_minutes: Math.max(0, Number(moduleItem.durationMinutes) || 0),
            status: String(attempt.status || 'completed'), score: Number(attempt.score) || 0,
            earned_marks: Number(attempt.earnedMarks) || 0, total_marks: Number(attempt.totalMarks) || questions.reduce((sum: number, question: any) => sum + Math.max(1, Number(question.marks) || 1), 0),
            violations: Number(attempt.violations ?? attempt.tabSwitches) || 0,
            started_at: attempt.startedAt || quiz?.submitted_at, submitted_at: attempt.endedAt || quiz?.submitted_at,
            ip_address: attempt.ipAddress || 'Unavailable', browser: attempt.browser || 'Unknown', operating_system: attempt.operatingSystem || 'Unknown',
            proctoring_events: Array.isArray(attempt.proctoringEvents) ? attempt.proctoringEvents : [],
          }));
          return [{ assessment_id: `module:${index}`, assessment_title: String(moduleItem.quiz || moduleItem.title || `Module ${index + 1} Test`), max_attempts: Math.max(1, Number(moduleItem.maxAttempts) || 3), duration_minutes: Math.max(0, Number(moduleItem.durationMinutes) || 0), question_count: questions.length, attempts_used: attempts.length, latest_score: attempts.at(-1)?.score ?? null, latest_status: attempts.at(-1)?.status ?? 'not_attempted', attempts }];
        }));
      } catch { /* malformed progress */ }
    }
    const demoAssessmentTitles = new Set(['TCS NQT Mock Set 4', 'Intro Module Check', 'Scanning Networks Quiz']);
    const publishedSettings = settings.filter((setting) => !demoAssessmentTitles.has(setting.assignment_title));
    const assignmentMap = new Map(assignments.map((assignment) => [assignment.course_id, assignment]));
    const attemptOut = (attempt: (typeof attempts)[number], setting: (typeof settings)[number]) => {
      return {
        attempt_id: attempt.id,
        assessment_id: attempt.assignment_id,
        assessment_title: setting.assignment_title,
        attempt_number: attempt.attempt_number ?? 1,
        max_attempts: setting.max_attempts ?? 1,
        duration_minutes: setting.duration_minutes ?? 0,
        status: attempt.status,
        score: attempt.score,
        violations: attempt.violations,
        started_at: attempt.started_at,
        submitted_at: attempt.ended_at,
        ip_address: attempt.ip_address || 'Unavailable',
        browser: attempt.browser || 'Unknown',
        operating_system: attempt.operating_system || 'Unknown',
        proctoring_events: attempt.assignment_events.map((event) => ({
          event_type: event.event_type,
          reason: event.reason,
          timestamp: event.created_at,
          details: event.details_json ?? {},
        })),
      };
    };
    const assessmentOut = (setting: (typeof settings)[number]) => {
      const assessmentAttempts = attempts.filter((attempt) => attempt.assignment_id === setting.assignment_id);
      const completed = assessmentAttempts.filter((attempt) => attempt.status !== 'in_progress');
      return {
        assessment_id: setting.assignment_id,
        assessment_title: setting.assignment_title,
        max_attempts: setting.max_attempts ?? 1,
        duration_minutes: setting.duration_minutes ?? 0,
        question_count: Array.isArray(setting.questions_json) ? setting.questions_json.length : 0,
        attempts_used: assessmentAttempts.length,
        latest_score: completed[0]?.score ?? null,
        latest_status: assessmentAttempts[0]?.status ?? 'not_attempted',
        attempts: assessmentAttempts.map((attempt) => attemptOut(attempt, setting)),
      };
    };
    const courses = publishedCourses.map((course) => {
      const prefix = `course:${course.id}:`;
      const courseSettings = publishedSettings.filter((setting) => setting.assignment_id.startsWith(prefix) && !setting.assignment_id.includes(':module-'));
      const courseAttempts = attempts.filter((attempt) => attempt.assignment_id.startsWith(prefix));
      const completed = courseAttempts.filter((attempt) => attempt.status !== 'in_progress');
      const metadata = course.metadata_json && typeof course.metadata_json === 'object'
        ? course.metadata_json as Record<string, unknown>
        : {};
      const assignment = assignmentMap.get(course.id);
      const snapshotAssessments = moduleAssessments.get(course.id) ?? [];
      const snapshotAttempts = snapshotAssessments.flatMap((assessment) => assessment.attempts);
      const allScores = [...completed.map((attempt) => attempt.score), ...snapshotAttempts.map((attempt) => attempt.score)];
      return {
        id: course.id,
        title: course.title,
        category: course.category,
        level: course.level,
        status: course.status,
        duration: String(metadata.duration ?? ''),
        instructor: String(metadata.instructor ?? ''),
        progress_percent: moduleProgress.get(course.id) ?? 0,
        assigned: Boolean(assignment),
        assigned_at: assignment?.assigned_at ?? null,
        assessment_count: courseSettings.length + snapshotAssessments.length,
        attempt_count: courseAttempts.length + snapshotAttempts.length,
        average_score: allScores.length
          ? Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length)
          : null,
        assessments: [...snapshotAssessments, ...courseSettings.map(assessmentOut)],
      };
    });
    const standalone = publishedSettings
      .filter((setting) => !/^course:\d+:/.test(setting.assignment_id))
      .map(assessmentOut);
    return {
      student_id: id,
      academic_student_id: academic?.id ?? null,
      student_email: profile.email,
      courses,
      standalone_assessments: standalone,
    };
  }

  async studentsOverview(batch?: string) {
    const selectedBatch = this.normalizeBatch(batch);
    const profileWhere = selectedBatch ? { batch: selectedBatch } : {};
    const emails = await this.batchEmails(batch);
    const [total, suspended, waiting, completed, approved] = await Promise.all([
      this.prisma.student_profiles.count({ where: profileWhere }),
      this.prisma.users.count({ where: { role: users_role.student, is_active: false, ...(emails ? { email: { in: emails } } : {}) } }),
      this.prisma.student_profiles.count({ where: { ...profileWhere, status: { in: ['', 'Waiting for Student'] } } }),
      this.prisma.student_profiles.count({ where: { ...profileWhere, status: { in: ['Completed', 'Approval Pending by Admin'] } } }),
      this.prisma.student_profiles.count({ where: { ...profileWhere, status: 'Approved' } }),
    ]);
    return {
      section: 'students',
      summary: {
        total_students: total, active_students: Math.max(0, total - suspended),
        waiting_for_profile: waiting, profile_approval_pending: completed, approved_profiles: approved,
      },
    };
  }

  async messageStudent(id: number, message: string, actor: string) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Student not found');
    if (!profile.email.toLowerCase().endsWith('@cyberlancers.in')) {
      throw new UnprocessableEntityException("Messages can only be delivered to a student's registered @cyberlancers.in email.");
    }
    await this.mail.sendStudentMessage(profile.email, profile.full_name || profile.first_name, message);
    const row = await this.prisma.admin_student_messages.create({
      data: {
        student_email: profile.email.toLowerCase(), message: message.trim(),
        sent_by: actor, sent_at: new Date(),
      },
    });
    return {
      id: row.id, student_email: row.student_email, message: row.message,
      sent_at: row.sent_at.toISOString(), email_sent: true,
    };
  }

  async scheduleReminder(id: number, dto: StudentReminderDto, actor: string) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Student not found');
    if (!profile.email.toLowerCase().endsWith('@cyberlancers.in')) {
      throw new UnprocessableEntityException("Reminders can only be scheduled for a student's registered @cyberlancers.in email.");
    }
    const [hour, minute] = dto.send_time_ist.split(':').map(Number);
    if (hour > 23 || minute > 59) throw new UnprocessableEntityException('Invalid IST reminder time');
    const time = new Date(Date.UTC(1970, 0, 1, hour, minute));
    const row = await this.prisma.student_daily_reminders.upsert({
      where: { student_email: profile.email.toLowerCase() },
      create: {
        student_email: profile.email.toLowerCase(), student_name: profile.full_name || profile.first_name,
        message: dto.message.trim(), send_time_ist: time, active: true, last_sent_on: null,
        created_by: actor, updated_at: new Date(),
      },
      update: {
        student_name: profile.full_name || profile.first_name, message: dto.message.trim(),
        send_time_ist: time, active: true, created_by: actor, updated_at: new Date(),
      },
    });
    return { id: row.id, student_email: row.student_email, send_time_ist: dto.send_time_ist, active: row.active };
  }

  async assignCourse(id: number, dto: StudentCourseDto, actor: string) {
    const [profile, course] = await Promise.all([
      this.prisma.student_profiles.findUnique({ where: { id } }),
      this.prisma.courses.findUnique({ where: { id: dto.course_id } }),
    ]);
    if (!profile) throw new NotFoundException('Student not found');
    if (!course || !['active', 'published'].includes(course.status)) throw new NotFoundException('Published course not found');
    const academic = await this.prisma.students.findFirst({ where: { users: { email: profile.email } } });
    if (!academic) throw new ConflictException('Student academic account is not linked');
    await this.prisma.$transaction([
      this.prisma.student_course_assignments.upsert({
        where: { student_id_course_id: { student_id: academic.id, course_id: course.id } },
        create: { student_id: academic.id, course_id: course.id, assigned_by: actor, assigned_at: new Date() },
        update: { assigned_by: actor, assigned_at: new Date() },
      }),
      this.prisma.student_profiles.update({ where: { id }, data: { tag: course.title, updated_at: new Date() } }),
      this.prisma.portal_access_settings.upsert({
        where: { scope_key: profile.email.toLowerCase() },
        create: {
          scope_key: profile.email.toLowerCase(), courses_enabled: true, assessments_enabled: false,
          jobs_enabled: false, updated_by: actor, updated_at: new Date(),
        },
        update: { courses_enabled: true, updated_by: actor, updated_at: new Date() },
      }),
    ]);
    return { assigned: true, student_id: id, course_id: course.id, course_title: course.title };
  }

  async resetStudentPassword(id: number) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Student not found');
    const user = await this.prisma.users.findUnique({ where: { email: profile.email } });
    if (!user || user.role !== users_role.student) throw new ConflictException('Student login account is not linked');
    const password = `Ca!${randomBytes(8).toString('base64url')}`;
    const recipient = (profile.personal_email || profile.email).trim().toLowerCase();
    const portal = `${this.config.get<string>('studentFrontendUrl')?.replace(/\/+$/, '')}/student/login`;
    await this.mail.sendStudentCredentials(recipient, profile.full_name || profile.first_name || profile.email, portal, profile.email, password);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.users.update({ where: { id: user.id }, data: { hashed_password: await bcrypt.hash(password, 12) } }),
      this.prisma.student_password_security.upsert({
        where: { user_id: user.id },
        create: { user_id: user.id, must_change_password: true, updated_at: now },
        update: { must_change_password: true, password_changed_at: null, updated_at: now },
      }),
    ]);
    return { reset: true, student_id: id, recipient, message: 'Temporary password emailed and activated successfully.' };
  }

  async createStudent(dto: StudentAccountDto, actorEmail = 'system') {
    const email = dto.credential_email.trim().toLowerCase();
    const deliveryEmail = dto.email.trim().toLowerCase();
    const registrationNumber = dto.register_number.trim();
    const batch = dto.batch.trim().replace(/\s+/g, ' ');
    const batchContext = await this.batchContext(actorEmail);
    if (!batchContext.batches.some((item) => item.name === batch)) {
      throw new UnprocessableEntityException('Create the batch from Select Batch before adding students to it');
    }
    if (dto.username.trim().toLowerCase() !== email) throw new UnprocessableEntityException('Draft username and Cyber Lancers login email must be identical');
    const domain = `@${this.config.get<string>('studentEmailDomain')}`;
    if (!email.endsWith(domain)) throw new UnprocessableEntityException(`Student login email must end with ${domain}`);
    const initialPassword = `Ca!${randomBytes(18).toString('base64url')}`;
    const hash = await bcrypt.hash(initialPassword, 12);
    let profile: any;
    let existingAccountRecovered = false;
    try {
      profile = await this.prisma.$transaction(async (tx) => {
        const [existingProfile, existingUser, existingStudent] = await Promise.all([
          tx.student_profiles.findFirst({ where: { OR: [{ email }, { registration_number: registrationNumber }, { cyberlancers_id: registrationNumber }] } }),
          tx.users.findUnique({ where: { email }, select: { id: true } }),
          tx.students.findUnique({ where: { usn: registrationNumber }, select: { id: true, user_id: true } }),
        ]);
        if (existingProfile) {
          const sameEmail = existingProfile.email.trim().toLowerCase() === email;
          const sameRegistration = [existingProfile.registration_number, existingProfile.cyberlancers_id]
            .some((value) => value.trim().toLowerCase() === registrationNumber.toLowerCase());
          if (!sameEmail || !sameRegistration) {
            throw new ConflictException(`Email or registration number belongs to a different student in batch ${existingProfile.batch || 'unknown'}. No account was changed.`);
          }
          existingAccountRecovered = true;
          const moved = await tx.student_profiles.update({
            where: { id: existingProfile.id },
            data: { batch, updated_at: new Date() },
          });
          await tx.audit_logs.create({
            data: {
              actor_email: actorEmail, action: 'EXISTING_STUDENT_BATCH_REASSIGNED',
              target_type: 'student', target_id: String(moved.id),
              details: JSON.stringify({ email, registrationNumber, previous_batch: existingProfile.batch, batch }),
              created_at: new Date(),
            },
          });
          return moved;
        }
        if (existingUser || existingStudent) {
          if (!existingUser || !existingStudent || existingStudent.user_id !== existingUser.id) {
            throw new ConflictException('Email or registration number belongs to a different or incomplete account. No account was changed.');
          }
          existingAccountRecovered = true;
          const recoveredProfile = await tx.student_profiles.create({
            data: {
              email, full_name: dto.name.trim(), first_name: dto.name.trim().split(/\s+/)[0],
              registration_number: registrationNumber, cyberlancers_id: '', phone: dto.phone ?? '',
              course: dto.degree ?? '', department: dto.branch ?? '', batch,
              status: 'Waiting for Student', tag: 'Profile Pending', gender: '', date_of_birth: '', college: '',
              resume_url: '', mentor_name: '', personal_email: deliveryEmail === email ? null : deliveryEmail, updated_at: new Date(),
            },
          });
          await tx.portal_access_settings.upsert({
            where: { scope_key: email },
            create: { scope_key: email, courses_enabled: false, assessments_enabled: false, jobs_enabled: false, updated_by: actorEmail, updated_at: new Date() },
            update: { updated_by: actorEmail, updated_at: new Date() },
          });
          await tx.audit_logs.create({
            data: {
              actor_email: actorEmail, action: 'MISSING_STUDENT_PROFILE_RECOVERED',
              target_type: 'student', target_id: String(recoveredProfile.id),
              details: JSON.stringify({ email, registrationNumber, batch }),
              created_at: new Date(),
            },
          });
          return recoveredProfile;
        }
        const createdProfile = await tx.student_profiles.create({
          data: {
            email, full_name: dto.name.trim(), first_name: dto.name.trim().split(/\s+/)[0],
            registration_number: registrationNumber, cyberlancers_id: '', phone: dto.phone ?? '',
            course: dto.degree ?? '', department: dto.branch ?? '', batch,
            status: 'Waiting for Student', tag: 'Profile Pending', gender: '', date_of_birth: '', college: '',
            resume_url: '', mentor_name: '', personal_email: deliveryEmail === email ? null : deliveryEmail, updated_at: new Date(),
          },
        });
        const user = await tx.users.create({ data: { email, hashed_password: hash, role: users_role.student, is_active: true, created_at: new Date() } });
        await tx.student_password_security.create({
          data: { user_id: user.id, must_change_password: true, updated_at: new Date() },
        });
        const departmentName = dto.branch?.trim() || 'General';
        let department = await tx.departments.findUnique({ where: { name: departmentName } });
        if (!department) department = await tx.departments.create({ data: { name: departmentName, code: (departmentName.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'GENERAL').slice(0, 20) } });
        await tx.students.create({ data: { user_id: user.id, department_id: department.id, full_name: dto.name.trim(), usn: registrationNumber, cgpa: new Prisma.Decimal(0), skills: '' } });
        await tx.portal_access_settings.create({ data: { scope_key: email, courses_enabled: false, assessments_enabled: false, jobs_enabled: false, updated_by: actorEmail, updated_at: new Date() } });
        await tx.audit_logs.create({ data: { actor_email: actorEmail, action: 'STUDENT_ACCOUNT_CREATED', target_type: 'student', target_id: String(createdProfile.id), details: JSON.stringify({ email, registrationNumber, batch }), created_at: new Date() } });
        return createdProfile;
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(`A student account already exists for ${email} or registration number ${registrationNumber}. No existing student was changed.`);
      throw error;
    }
    const response: any = await this.profileResponse(profile);
    if (existingAccountRecovered) {
      response.credential_email_sent = false;
      response.existing_account_recovered = true;
      response.credential_delivery_message = `Existing student was safely restored in batch ${batch}. Login credentials were not changed.`;
      return response;
    }
    if (dto.send_credentials) {
      try {
        await this.mail.sendStudentCredentials(deliveryEmail, dto.name, dto.portal_link, email, initialPassword);
      } catch (error) {
        response.credential_email_sent = false;
        response.credential_delivery_message = `Student account was safely stored, but credential email was not sent: ${error instanceof Error ? error.message : String(error)}. Use Send Portal Login to retry.`;
        return response;
      }
      response.credential_email_sent = true;
      response.credential_delivery_message = 'Credential email sent';
    }
    return response;
  }

  async sendCredentials(id: number, dto: CredentialSendDto) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Student not found');
    const oldEmail = profile.email.toLowerCase();
    const loginEmail = dto.login_email.trim().toLowerCase();
    const domain = `@${this.config.get<string>('studentEmailDomain')}`;
    if (!loginEmail.endsWith(domain)) throw new UnprocessableEntityException(`Student login email must end with ${domain}`);
    const user = await this.prisma.users.findUnique({ where: { email: oldEmail } });
    if (!user) throw new ConflictException('Student login account does not exist. Create the account first.');
    const replacementPassword = `Ca!${randomBytes(18).toString('base64url')}`;
    await this.mail.sendStudentCredentials(dto.recipient_email.trim().toLowerCase(), dto.student_name, dto.portal_link, loginEmail, replacementPassword);
    await this.prisma.$transaction([
      this.prisma.student_profiles.update({
        where: { id }, data: {
          email: loginEmail, full_name: dto.student_name.trim(),
          first_name: dto.student_name.trim().split(/\s+/)[0], updated_at: new Date(),
        },
      }),
      this.prisma.users.update({
        where: { id: user.id },
        data: { email: loginEmail, hashed_password: await bcrypt.hash(replacementPassword, 12), role: users_role.student, is_active: true },
      }),
      this.prisma.student_password_security.upsert({
        where: { user_id: user.id },
        create: { user_id: user.id, must_change_password: true, updated_at: new Date() },
        update: { must_change_password: true, password_changed_at: null, updated_at: new Date() },
      }),
      this.prisma.portal_access_settings.updateMany({ where: { scope_key: oldEmail }, data: { scope_key: loginEmail } }),
    ]);
    return {
      student_id: id, login_email: loginEmail, delivered_to: dto.recipient_email.trim().toLowerCase(),
      password_verified: true, sent: true, message: 'Credential email sent',
    };
  }

  async setStudentStatus(id: number, status: string) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Student not found');
    const updated = await this.prisma.student_profiles.update({
      where: { id },
      data: {
        status,
        tag: status === 'Approved' ? 'Profile Approved - Course Pending' : 'Profile Completed - Approval Pending',
        updated_at: new Date(),
      },
    });
    return this.profileResponse(updated);
  }

  async suspendStudent(id: number) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Student not found');
    const updated = await this.prisma.student_profiles.update({ where: { id }, data: { status: 'suspended', updated_at: new Date() } });
    await this.prisma.users.updateMany({ where: { email: profile.email }, data: { is_active: false } });
    return this.profileResponse(updated);
  }

  async deleteStudent(id: number, confirmation: string, actorEmail = 'system') {
    const profile = await this.prisma.student_profiles.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Student not found');
    const email = profile.email.toLowerCase();
    if (confirmation.trim().toLowerCase() !== email) throw new ConflictException('Deletion confirmation did not match the student email. No data was removed.');
    const user = await this.prisma.users.findUnique({ where: { email }, include: { students: true } });
    const studentId = user?.students[0]?.id;
    await this.prisma.$transaction(async (tx) => {
      if (studentId) {
        const attempts = await tx.assignment_attempts.findMany({ where: { OR: [{ student_id: studentId }, { student_email: email }] }, select: { id: true } });
        await tx.assignment_events.deleteMany({ where: { attempt_id: { in: attempts.map((row) => row.id) } } });
        await tx.assignment_attempts.deleteMany({ where: { OR: [{ student_id: studentId }, { student_email: email }] } });
        await tx.student_course_assignments.deleteMany({ where: { student_id: studentId } });
        await tx.resume_analyses.deleteMany({ where: { student_id: studentId } });
        await tx.assessment_submissions.deleteMany({ where: { student_id: studentId } });
        await tx.applications.deleteMany({ where: { student_id: studentId } });
        await tx.students.delete({ where: { id: studentId } });
      }
      await tx.admin_student_messages.deleteMany({ where: { student_email: email } });
      await tx.student_daily_reminders.deleteMany({ where: { student_email: email } });
      await tx.student_job_search_preferences.deleteMany({ where: { student_email: email } });
      await tx.portal_access_settings.deleteMany({ where: { scope_key: email } });
      await tx.email_otps.deleteMany({ where: { email } });
      await tx.password_reset_tokens.deleteMany({ where: { email } });
      await tx.student_profiles.delete({ where: { id } });
      if (user) await tx.users.delete({ where: { id: user.id } });
      await tx.audit_logs.create({ data: { actor_email: actorEmail, action: 'STUDENT_ACCOUNT_PERMANENTLY_DELETED', target_type: 'student', target_id: String(id), details: JSON.stringify({ email }), created_at: new Date() } });
    });
    return { deleted: true, student_id: id, email, message: 'Student account and associated data were permanently deleted.' };
  }

  @Cron('*/1 * * * *')
  async sendDueReminders() {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const today = new Date(Date.UTC(ist.getFullYear(), ist.getMonth(), ist.getDate()));
    const minute = ist.getHours() * 60 + ist.getMinutes();
    const rows = await this.prisma.student_daily_reminders.findMany({ where: { active: true } });
    for (const row of rows) {
      if (row.last_sent_on?.toISOString().slice(0, 10) === today.toISOString().slice(0, 10)) continue;
      const sendMinute = row.send_time_ist.getUTCHours() * 60 + row.send_time_ist.getUTCMinutes();
      if (minute < sendMinute) continue;
      try {
        await this.mail.sendStudentMessage(row.student_email, row.student_name, row.message);
        await this.prisma.student_daily_reminders.update({ where: { id: row.id }, data: { last_sent_on: today } });
      } catch {
        // Leave last_sent_on unchanged so the next scheduler cycle retries.
      }
    }
  }

  async provisionStudentLogin(dto: LegacyStudentLoginDto) {
    const email = dto.email.toLowerCase();
    const domain = `@${this.config.get<string>('studentEmailDomain')}`;
    if (!email.endsWith(domain)) throw new ForbiddenException(`Student email must end with ${domain}`);
    const password = dto.password || `Ca!${randomBytes(8).toString('base64url')}`;
    const name = dto.full_name.trim() || dto.username.trim() || email.split('@')[0];
    const registration = (dto.registration_number || dto.cyberlancers_id || email.split('@')[0]).slice(0, 40);
    const existing = await this.prisma.users.findUnique({ where: { email } });
    if (existing) {
      const academic = await this.prisma.students.findFirst({ where: { user_id: existing.id } });
      return { ok: true, created: false, email, username: email, student_id: academic?.id, email_sent: false, email_error: '', message: 'Student login already exists and was left unchanged.' };
    }
    const result = await this.createStudent({
      name, register_number: registration, email, username: email, credential_email: email,
      temp_password: password,
      portal_link: `${this.config.get<string>('studentFrontendUrl')?.replace(/\/+$/, '')}/student/login`,
      degree: dto.course, branch: dto.department, batch: dto.batch, phone: '',
      send_credentials: dto.send_email,
    });
    const academic = await this.prisma.students.findFirst({ where: { users: { email } } });
    return {
      ok: true, created: !existing, email, username: email, student_id: academic?.id,
      email_sent: result.credential_email_sent, email_error: '',
      message: 'Student login is active and can be used in the normal login flow.',
    };
  }
}
