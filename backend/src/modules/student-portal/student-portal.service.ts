import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import * as bcrypt from 'bcryptjs';
import {
  ApplicationStatusDto,
  StudentProfileDto,
  StudentProfileCompleteDto,
} from './dto/student-portal.dto';

const KARNATAKA_JOB_LOCATIONS = /(karnataka|bengaluru|bangalore|mysuru|mysore|mangaluru|mangalore|hubballi|dharwad|belagavi|belgaum|tumakuru|udupi|shivamogga)/i;
const INDIA_JOB_LOCATIONS = /(india|karnataka|bengaluru|bangalore|mysuru|mysore|mangaluru|mangalore|hubballi|dharwad|belagavi|belgaum|tumakuru|udupi|shivamogga|delhi|noida|gurugram|gurgaon|mumbai|pune|hyderabad|chennai|kolkata|kochi|cochin|ahmedabad|jaipur|chandigarh|remote.*india)/i;

@Injectable()
export class StudentPortalService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}

  private jobOut(job: any) {
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      experience: job.experience,
      salary: job.salary,
      employment_type: job.employment_type,
      skills: String(job.skills ?? '').split(',').map((v) => v.trim()).filter(Boolean),
      description: job.description,
      posted_date: job.posted_date,
      apply_url: job.apply_url,
      company_logo: job.company_logo,
      match_score: job.match_score,
      is_entry_level: job.is_entry_level,
      created_at: job.created_at,
      updated_at: job.updated_at,
    };
  }

  private safeLimit(value: number | undefined, fallback = 500, max = 1000) {
    const limit = Number(value ?? fallback);
    if (!Number.isInteger(limit) || limit < 1 || limit > max) {
      throw new BadRequestException(`limit must be between 1 and ${max}`);
    }
    return limit;
  }

  private eligibleFresherIndiaJob(job: any) {
    const text = `${job.title ?? ''} ${job.description ?? ''}`.toLowerCase();
    const cyber = /(cyber|security|soc|siem|threat|incident|vapt|penetration)/.test(text);
    const entry = /(fresher|entry.level|junior|graduate|trainee|intern(?:ship)?|campus|new grad|0\s*(?:-|to)\s*[12]\s*years?|up to 2 years?)/.test(text);
    const senior = /(senior|lead|manager|principal|architect|staff engineer|[3-9]\+?\s*years?|[2-9]\s*(?:-|to)\s*[3-9]\s*years?)/.test(text.slice(0, 14_000));
    const location = String(job.location ?? '');
    const india = INDIA_JOB_LOCATIONS.test(`${location} ${String(job.description ?? '').slice(0, 3_000)}`)
      && !/(united states|usa|canada|europe|united kingdom|uk only|australia|singapore|germany|france)/i.test(location);
    return cyber && entry && !senior && india;
  }

  companies() {
    return this.prisma.companies.findMany({ orderBy: { name: 'asc' } });
  }

  private availableJobsWhere(extra: Prisma.jobsWhereInput = {}): Prisma.jobsWhereInput {
    return {
      AND: [
        { is_entry_level: true },
        extra,
        {
          OR: [
            { title: { contains: 'cyber' } },
            { title: { contains: 'security' } },
            { title: { contains: 'SOC' } },
            { title: { contains: 'SIEM' } },
            { title: { contains: 'VAPT' } },
            { description: { contains: 'cybersecurity' } },
          ],
        },
      ],
    };
  }

  private async batchJobWhere(email?: string): Promise<Prisma.jobsWhereInput> {
    if (!email) return {};
    const [profile, availabilityRows] = await Promise.all([
      this.prisma.student_profiles.findUnique({ where: { email: email.toLowerCase() }, select: { batch: true } }),
      this.prisma.admin_snapshots.findMany({
        where: { key: { startsWith: 'job-availability:' } },
        select: { key: true, payload: true },
      }),
    ]);
    if (!profile) return { id: -1 };
    const closedIds = availabilityRows
      .filter((row) => {
        try { return JSON.parse(row.payload)?.status === 'closed'; } catch { return false; }
      })
      .map((row) => Number(row.key.slice('job-availability:'.length)))
      .filter((id) => Number.isInteger(id) && id > 0);
    return {
      AND: [
        { platform: `admin:${profile.batch}` },
        ...(closedIds.length ? [{ id: { notIn: closedIds } }] : []),
      ],
    };
  }

  async availableJobsCount(extra: Prisma.jobsWhereInput = {}, email?: string) {
    const rows = await this.prisma.jobs.findMany({
      where: { AND: [this.availableJobsWhere(extra), await this.batchJobWhere(email)] },
      distinct: ['apply_url'],
    });
    return rows.filter((row) => this.eligibleFresherIndiaJob(row)).length;
  }

  async jobs(limit?: number, extra: Prisma.jobsWhereInput = {}, email?: string) {
    const rows = await this.prisma.jobs.findMany({
      where: { AND: [this.availableJobsWhere(extra), await this.batchJobWhere(email)] },
      orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
      distinct: ['apply_url'],
    });
    const preferred = rows.filter((row) => this.eligibleFresherIndiaJob(row)).sort((left, right) => {
      const locationPriority = Number(KARNATAKA_JOB_LOCATIONS.test(right.location)) - Number(KARNATAKA_JOB_LOCATIONS.test(left.location));
      return locationPriority || right.updated_at.getTime() - left.updated_at.getTime() || right.id - left.id;
    });
    return preferred.slice(0, this.safeLimit(limit)).map((row) => this.jobOut(row));
  }

  async latestJobs(limit?: number) {
    const rows = await this.prisma.jobs.findMany({
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: this.safeLimit(limit, 100),
    });
    return rows.map((row) => this.jobOut(row));
  }

  async platformJobs(platform: string, limit?: number) {
    const rows = await this.prisma.jobs.findMany({
      where: { platform: { equals: platform } },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: this.safeLimit(limit),
    });
    return rows.map((row) => this.jobOut(row));
  }

  async searchJobs(q: string, location?: string, limit?: number) {
    const text = q.trim();
    const rows = await this.prisma.jobs.findMany({
      where: {
        AND: [
          {
            OR: [
              { title: { contains: text } },
              { company: { contains: text } },
              { skills: { contains: text } },
              { description: { contains: text } },
            ],
          },
          ...(location ? [{ location: { contains: location.trim() } }] : []),
        ],
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: this.safeLimit(limit),
    });
    return rows.map((row) => this.jobOut(row));
  }

  async locations(limit?: number) {
    const rows = await this.prisma.jobs.findMany({
      distinct: ['location'],
      select: { location: true },
      orderBy: { location: 'asc' },
      take: this.safeLimit(limit, 100, 300),
    });
    return rows.map((row) => row.location).filter(Boolean);
  }

  async job(id: number) {
    const row = await this.prisma.jobs.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Job not found');
    return this.jobOut(row);
  }

  private async studentByEmail(email: string) {
    return this.prisma.students.findFirst({
      where: { users: { email: email.toLowerCase() } },
      include: { users: true },
    });
  }

  async setApplicationStatus(jobId: number, dto: ApplicationStatusDto) {
    const [job, student] = await Promise.all([
      this.prisma.jobs.findUnique({ where: { id: jobId } }),
      this.studentByEmail(dto.email),
    ]);
    if (!job) throw new NotFoundException('Job not found');
    if (!student) throw new NotFoundException('Student account not found');
    if (dto.status !== 'applied') {
      return { jobId, studentId: student.id, status: dto.status, changedAt: null };
    }
    const activity = await this.prisma.applications.create({
      data: { student_id: student.id, job_id: jobId, status: 'applied', applied_at: new Date() },
    });
    return {
      id: activity.id,
      jobId,
      studentId: student.id,
      status: 'applied',
      changedAt: activity.applied_at.toISOString(),
    };
  }

  async applicationStatuses(email: string) {
    const student = await this.studentByEmail(email);
    if (!student) return [];
    const rows = await this.prisma.applications.findMany({
      where: { student_id: student.id },
      orderBy: { applied_at: 'desc' },
    });
    const latest = new Map<number, (typeof rows)[number]>();
    rows.forEach((row) => { if (!latest.has(row.job_id)) latest.set(row.job_id, row); });
    return [...latest.values()].map((row) => ({
      jobId: row.job_id,
      status: row.status,
      updatedAt: row.applied_at.toISOString(),
    }));
  }

  async appliedJobs(email: string) {
    const student = await this.studentByEmail(email);
    if (!student) return [];
    const rows = await this.prisma.applications.findMany({
      where: { student_id: student.id, status: 'applied' },
      include: { jobs: true },
      orderBy: { applied_at: 'desc' },
    });
    return rows.map(({ jobs: job, ...application }) => ({
      applicationId: application.id,
      jobId: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      appliedAt: application.applied_at.toISOString(),
    }));
  }

  async recommendedJobs(studentId: number, limit?: number) {
    const student = await this.prisma.students.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    const skills = student.skills.split(',').map((v) => v.trim()).filter(Boolean);
    const rows = await this.prisma.jobs.findMany({
      where: skills.length ? { OR: skills.map((skill) => ({ skills: { contains: skill } })) } : { is_entry_level: true },
      orderBy: [{ match_score: 'desc' }, { created_at: 'desc' }],
      take: this.safeLimit(limit),
    });
    return rows.map((row) => this.jobOut(row));
  }

  private profileOut(profile: any) {
    const incomplete = ['', 'Waiting for Student', 'Registration Verified - Awaiting Admin Account'].includes(profile.status);
    const blankable = ['full_name', 'first_name', 'cyberlancers_id', 'registration_number', 'phone', 'gender', 'date_of_birth', 'tag', 'batch', 'course', 'college', 'department'];
    const result = { ...profile };
    if (incomplete) blankable.forEach((key) => { result[key] = ''; });
    result.updated_at = profile.updated_at instanceof Date ? profile.updated_at.toISOString() : String(profile.updated_at || "");
    delete result.personal_email;
    return result;
  }

  async getProfile(email: string) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { email: email.toLowerCase() } });
    if (!profile) throw new NotFoundException('Student profile not found');
    return this.profileOut(profile);
  }

  async saveProfile(dto: StudentProfileDto) {
    const email = dto.email.trim().toLowerCase();
    let education: Array<Record<string, unknown>> = [];
    try { const parsed = JSON.parse(dto.education_json || '[]'); education = Array.isArray(parsed) ? parsed : []; } catch { education = []; }
    const required = [dto.full_name, dto.registration_number, dto.phone, dto.gender, dto.date_of_birth, dto.batch, dto.college, dto.department];
    const firstName = dto.first_name || dto.full_name.trim().split(/\s+/)[0] || '';
    const profile = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.student_profiles.findUnique({ where: { email }, select: { status: true, education_json: true } });
      let existingEducation: Array<Record<string, unknown>> = [];
      try { const parsed = JSON.parse(existing?.education_json || '[]'); existingEducation = Array.isArray(parsed) ? parsed : []; } catch { existingEducation = []; }
      education = education.map((record) => {
        const previous = existingEducation.find((item) => item.level === record.level);
        const fileName = String(record.markscardFileName || '').trim();
        const dataUrl = String(record.markscardDataUrl || '').trim();
        return {
          ...record,
          markscardDataUrl: dataUrl || (fileName ? String(previous?.markscardDataUrl || '') : ''),
        };
      });
      dto.education_json = JSON.stringify(education);
      const educationComplete = (level: string) => {
        const record = education.find((item) => item.level === level);
        return Boolean(record && String(record.institution || '').trim() && String(record.yearFrom || '').trim() && String(record.yearTo || '').trim() && String(record.score || '').trim() && String(record.markscardDataUrl || '').trim());
      };
      const educationReady = educationComplete('Class 10') && (educationComplete('PUC') || educationComplete('Diploma')) && educationComplete('Degree');
      if (!educationComplete('Class 10')) throw new BadRequestException('Complete the Class 10 institution, years, score, and markscard before saving.');
      if (!educationComplete('PUC') && !educationComplete('Diploma')) throw new BadRequestException('Complete either PUC or Diploma institution, years, score, and markscard before saving.');
      if (!educationComplete('Degree')) throw new BadRequestException('Complete the Degree institution, years, score, and markscard before saving.');
      // Approval is an administrative decision. Saving a profile must never
      // allow a student to mark it approved or reset an existing approval.
      const status = existing?.status === 'Approved'
        ? 'Approved'
        : required.every((value) => value.trim()) && educationReady
          ? 'Approval Pending by Admin'
          : 'Waiting for Student';
      const { status: _studentProvidedStatus, ...profileData } = dto;
      const saved = await tx.student_profiles.upsert({
        where: { email },
        create: { ...profileData, email, first_name: firstName, status, updated_at: new Date() },
        update: { ...profileData, email, first_name: firstName, status, updated_at: new Date() },
      });
      const user = await tx.users.findUnique({ where: { email }, include: { students: true } });
      const profileUsn = (dto.registration_number || dto.cyberlancers_id).trim().slice(0, 40);
      // Historical imports can leave more than one academic row for a user. Select
      // the row already linked to this profile's registration number, not an arbitrary row.
      const student = user?.students.find((candidate) => candidate.usn === profileUsn) ?? user?.students[0];
      if (student) {
        let departmentId = student.department_id;
        if (dto.department) {
          const department = await tx.departments.upsert({
            where: { name: dto.department },
            create: {
              name: dto.department,
              code: (dto.department.toUpperCase().replace(/\s/g, '') || 'CYBER').slice(0, 20),
            },
            update: {},
          });
          departmentId = department.id;
        }
        const nextUsn = profileUsn || student.usn;
        const usnOwner = await tx.students.findUnique({ where: { usn: nextUsn }, select: { id: true } });
        if (usnOwner && usnOwner.id !== student.id) {
          throw new ConflictException('Registration number is already linked to another student account.');
        }
        await tx.students.update({
          where: { id: student.id },
          data: {
            department_id: departmentId,
            full_name: dto.full_name || student.full_name,
            usn: nextUsn,
            resume_url: dto.resume_url || student.resume_url,
            skills: dto.tag || student.skills,
          },
        });
      }
      return saved;
    });
    return this.profileOut(profile);
  }

  async courses(status = 'active', email?: string) {
    const profile = email ? await this.prisma.student_profiles.findUnique({ where: { email: email.toLowerCase() }, select: { batch: true } }) : null;
    const rows = await this.prisma.courses.findMany({
      where: status ? { status } : {},
      orderBy: { updated_at: 'desc' },
      select: {
        id: true, title: true, heading: true, category: true, level: true, status: true,
        progress_percent: true, assessments: true, labs: true, start_date: true, end_date: true,
        icon: true, color: true, metadata_json: true, updated_at: true,
      },
    });
    const scopedRows = profile ? rows.filter((row) => (row.metadata_json as any)?.target_batch === profile.batch) : rows;
    if (!email) return scopedRows.map(({ metadata_json, ...row }) => ({ ...row, metadata: metadata_json ?? {} }));
    const [moduleSnapshots, progressSnapshots] = await Promise.all([
      this.prisma.admin_snapshots.findMany({ where: { key: { startsWith: 'course-editor-modules-' } } }),
      this.prisma.admin_snapshots.findMany({ where: { key: { endsWith: `:${email.toLowerCase()}` }, } }),
    ]);
    const moduleDefinitions = new Map<number, Array<{ generatedQuestions?: unknown[] }>>();
    const moduleCount = new Map<number, number>();
    const quizCount = new Map<number, number>();
    for (const snapshot of moduleSnapshots) {
      const match = /^course-editor-modules-(\d+)-v2$/.exec(snapshot.key);
      if (!match) continue;
      try {
        const modules = JSON.parse(snapshot.payload);
        if (!Array.isArray(modules)) continue;
        moduleDefinitions.set(Number(match[1]), modules);
        moduleCount.set(Number(match[1]), modules.length);
        quizCount.set(Number(match[1]), modules.filter((module: any) => Array.isArray(module?.generatedQuestions) && module.generatedQuestions.length > 0).length);
      } catch { /* ignore malformed draft */ }
    }
    const completedCount = new Map<number, number>();
    for (const snapshot of progressSnapshots) {
      const match = /^course-progress:(\d+):/.exec(snapshot.key);
      if (!match) continue;
      try {
        const progress = JSON.parse(snapshot.payload) as { videos?: number[]; quizzes?: Record<string, { passed?: boolean }> };
        const courseId = Number(match[1]);
        const definitions = moduleDefinitions.get(courseId) ?? [];
        const completed = definitions.filter((moduleItem, index) => {
          const hasTest = Array.isArray(moduleItem.generatedQuestions) && moduleItem.generatedQuestions.length > 0;
          // Courses are test-only now. Legacy empty modules must not leave a
          // learner permanently stuck below 100% after all real tests pass.
          return hasTest ? Boolean(progress.quizzes?.[String(index)]?.passed) : true;
        }).length;
        completedCount.set(courseId, completed);
      } catch { /* ignore malformed progress */ }
    }
    return scopedRows.map(({ metadata_json, ...row }) => {
      const total = moduleCount.get(row.id) ?? 0;
      const completed = completedCount.get(row.id) ?? 0;
      return {
        ...row, metadata: metadata_json ?? {}, progress_percent: total ? Math.round((completed / total) * 100) : 0,
        modules_count: total, quizzes: quizCount.get(row.id) ?? 0,
      };
    });
  }

  private async snapshot(key: string, fallback: unknown) {
    const row = await this.prisma.admin_snapshots.findUnique({ where: { key } });
    if (!row) return fallback;
    try { return JSON.parse(row.payload); } catch { return fallback; }
  }

  private moduleQuizId(courseId: number, index: number, title: string) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'module';
    return `course:${courseId}:module-${index + 1}-${slug}`;
  }

  async completeModuleVideo(courseId: number, email: string, moduleIndex: number) {
    if (!Number.isInteger(moduleIndex) || moduleIndex < 0 || moduleIndex > 500) throw new BadRequestException('Invalid module index');
    const key = `course-progress:${courseId}:${email.toLowerCase()}`;
    const current = await this.snapshot(key, {}) as { videos?: number[]; quizzes?: Record<string, unknown> };
    const videos = new Set(Array.isArray(current.videos) ? current.videos : []);
    videos.add(moduleIndex);
    await this.prisma.admin_snapshots.upsert({
      where: { key }, create: { key, payload: JSON.stringify({ ...current, videos: [...videos] }), updated_by: email, updated_at: new Date() },
      update: { payload: JSON.stringify({ ...current, videos: [...videos] }), updated_by: email, updated_at: new Date() },
    });
    return { completed: true, module_index: moduleIndex };
  }

  async submitModuleQuiz(
    courseId: number, email: string, moduleIndex: number, answers: Record<string, string>,
    metadata: { startedAt?: string; tabSwitches?: number; browser?: string; operatingSystem?: string; violationReason?: string; ip?: string; userAgent?: string; proctoringEvents?: Array<Record<string, unknown>> } = {},
  ) {
    const modules = await this.snapshot(`course-editor-modules-${courseId}-v2`, []) as Array<Record<string, any>>;
    const module = modules[moduleIndex];
    if (!module || !Array.isArray(module.generatedQuestions) || !module.generatedQuestions.length) throw new NotFoundException('Module quiz not found');
    const questions = module.generatedQuestions;
    const totalMarks = questions.reduce((sum, question) => sum + Math.max(1, Number(question.marks) || 1), 0);
    const earnedMarks = questions.reduce((sum, question, index) => {
      const correct = String(answers[String(index)] ?? '').trim() === String(question.answer ?? '').trim();
      return sum + (correct ? Math.max(1, Number(question.marks) || 1) : 0);
    }, 0);
    const score = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
    const requiredScore = Math.max(1, Math.min(100, Number(module.passPercent) || 60));
    const violationReason = metadata.violationReason?.trim() || '';
    const passed = !violationReason && score >= requiredScore;
    const key = `course-progress:${courseId}:${email.toLowerCase()}`;
    type QuizAttempt = { attemptNumber: number; status?: 'completed' | 'auto_submitted'; startedAt: string; endedAt: string; durationSeconds: number; score: number; earnedMarks: number; totalMarks: number; passed: boolean; tabSwitches: number; browser: string; operatingSystem: string; ipAddress: string; violations?: number; violationReason?: string; proctoringEvents?: Array<Record<string, unknown>> };
    type QuizProgress = { score: number; passed: boolean; submitted_at: string; attempts?: QuizAttempt[] };
    const current = await this.snapshot(key, {}) as { videos?: number[]; quizzes?: Record<string, QuizProgress> };
    const previous = current.quizzes?.[String(moduleIndex)];
    const attempts: QuizAttempt[] = previous?.attempts ? [...previous.attempts] : previous?.submitted_at ? [{ attemptNumber: 1, startedAt: previous.submitted_at, endedAt: previous.submitted_at, durationSeconds: 0, score: previous.score, earnedMarks: Math.round((previous.score / 100) * totalMarks), totalMarks, passed: previous.passed, tabSwitches: 0, browser: 'Unknown', operatingSystem: 'Unknown', ipAddress: 'Unavailable' }] : [];
    const maxAttempts = Math.max(1, Math.min(20, Number(module.maxAttempts || 3)));
    if (attempts.length >= maxAttempts) throw new ConflictException('Maximum attempts reached for this test');
    const endedAt = new Date();
    const parsedStart = metadata.startedAt ? new Date(metadata.startedAt) : endedAt;
    const startedAt = Number.isNaN(parsedStart.getTime()) || parsedStart > endedAt ? endedAt : parsedStart;
    const agent = metadata.userAgent || '';
    const detectedBrowser = agent.includes('Edg/') ? 'Microsoft Edge' : agent.includes('Chrome/') ? 'Chrome' : agent.includes('Firefox/') ? 'Firefox' : agent.includes('Safari/') ? 'Safari' : 'Browser';
    const proctoringEvents = Array.isArray(metadata.proctoringEvents) ? metadata.proctoringEvents.slice(-100) : [];
    const attempt: QuizAttempt = { attemptNumber: attempts.length + 1, status: violationReason ? 'auto_submitted' : 'completed', startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), durationSeconds: Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)), score, earnedMarks, totalMarks, passed, tabSwitches: Math.max(0, Number(metadata.tabSwitches) || 0), browser: metadata.browser?.trim() || detectedBrowser, operatingSystem: metadata.operatingSystem?.trim() || 'Unknown', ipAddress: metadata.ip?.trim() || 'Unavailable', violations: proctoringEvents.filter((event) => event.severity === 'warning' || event.severity === 'critical').length || (violationReason ? 1 : 0), violationReason: violationReason || undefined, proctoringEvents };
    attempts.push(attempt);
    const quizzes = { ...(current.quizzes ?? {}), [String(moduleIndex)]: { score: Math.max(Number(previous?.score) || 0, score), passed: Boolean(previous?.passed) || passed, submitted_at: endedAt.toISOString(), attempts } };
    await this.prisma.admin_snapshots.upsert({ where: { key }, create: { key, payload: JSON.stringify({ videos: current.videos ?? [], quizzes }), updated_by: email, updated_at: endedAt }, update: { payload: JSON.stringify({ videos: current.videos ?? [], quizzes }), updated_by: email, updated_at: endedAt } });
    return { submitted: true, score, earnedMarks, totalMarks, passed, violation: violationReason || null, required_score: requiredScore, attempt, attemptsUsed: attempts.length, maxAttempts };
  }

  async courseContent(courseId: number, email: string) {
    const course = await this.prisma.courses.findUnique({ where: { id: courseId } });
    if (!course || !['active', 'published'].includes(course.status)) {
      throw new NotFoundException('Published course not found');
    }
    const profile = await this.prisma.student_profiles.findUnique({ where: { email: email.toLowerCase() }, select: { batch: true } });
    if (!profile || (course.metadata_json as any)?.target_batch !== profile.batch) throw new NotFoundException('Course not found in student batch');
    const [modules, banner, settings, assessments, progress, assessmentAttempts] = await Promise.all([
      this.snapshot(`course-editor-modules-${courseId}-v2`, []),
      this.snapshot(`course-editor-banner-${courseId}-v1`, {}),
      this.snapshot(`course-settings-${courseId}-v1`, {}),
      this.prisma.assignment_security_settings.findMany({
        where: { assignment_id: { startsWith: `course:${courseId}:` }, published: true, active: true },
        orderBy: { created_at: 'asc' },
      }),
      this.snapshot(`course-progress:${courseId}:${email.toLowerCase()}`, {}),
      this.prisma.assignment_attempts.findMany({ where: { assignment_id: { startsWith: `course:${courseId}:` }, student_email: email.toLowerCase() }, orderBy: { started_at: 'asc' } }),
    ]);
    const moduleList = Array.isArray(modules) ? modules as Array<Record<string, any>> : [];
    const watched = new Set(Array.isArray((progress as any)?.videos) ? (progress as any).videos : []);
    let previousComplete = true;
    const studentModules = moduleList.map((module, index) => {
      const questions = Array.isArray(module.generatedQuestions) ? module.generatedQuestions : [];
      const videoCompleted = true;
      const quizPassed = !questions.length || Boolean((progress as any)?.quizzes?.[String(index)]?.passed);
      const accessible = index === 0 || previousComplete;
      const required = module.unlockRule === 'manual' ? true : quizPassed;
      previousComplete = accessible && required;
      const publicQuestions = questions.map((question: any) => ({ question: question.question, options: question.options, marks: Math.max(1, Number(question.marks) || 1) }));
      const quizProgress = (progress as any)?.quizzes?.[String(index)];
      const totalMarks = publicQuestions.reduce((sum, question) => sum + question.marks, 0);
      const rawAttempts = Array.isArray(quizProgress?.attempts) ? quizProgress.attempts : quizProgress?.submitted_at ? [{ attemptNumber: 1, startedAt: quizProgress.submitted_at, endedAt: quizProgress.submitted_at, durationSeconds: 0, score: quizProgress.score, passed: quizProgress.passed, tabSwitches: 0, browser: 'Unknown', operatingSystem: 'Unknown', ipAddress: 'Unavailable' }] : [];
      const quizAttempts = rawAttempts.map((attempt: any) => ({ ...attempt, totalMarks: Math.max(0, Number(attempt.totalMarks) || totalMarks), earnedMarks: Number.isFinite(Number(attempt.earnedMarks)) ? Number(attempt.earnedMarks) : Math.round(((Number(attempt.score) || 0) / 100) * totalMarks) }));
      return { ...module, generatedQuestions: publicQuestions, totalMarks, locked: !accessible, accessible, completed: required, videoCompleted, quizPassed, maxAttempts: Math.max(1, Math.min(20, Number(module.maxAttempts || 3))), quizAttempts };
    });
    return {
      course: {
        id: course.id, title: course.title, heading: course.heading, category: course.category,
        level: course.level, status: course.status, metadata: course.metadata_json ?? {}, banner,
        startDate: (settings as any)?.startDate || course.start_date?.toISOString() || null, endDate: (settings as any)?.endDate || course.end_date?.toISOString() || null,
      },
      // A learner must always be able to start a published course.  This also
      // repairs old course snapshots that marked every module as locked.
      modules: studentModules,
      assessments: assessments.filter((item) => !item.assignment_id.includes(':module-')).map((item) => ({
        assignmentId: item.assignment_id,
        title: item.assignment_title,
        durationMinutes: item.duration_minutes,
        maxAttempts: item.max_attempts,
        resumeAllowed: item.resume_allowed,
        questionCount: Array.isArray(item.questions_json) ? item.questions_json.length : 0,
        totalMarks: Array.isArray(item.questions_json) ? (item.questions_json as any[]).reduce((sum, question) => sum + Math.max(1, Number(question.marks) || 1), 0) : 0,
        attempts: assessmentAttempts.filter((attempt) => attempt.assignment_id === item.assignment_id).map((attempt) => ({
          attemptNumber: attempt.attempt_number, startedAt: attempt.started_at, endedAt: attempt.ended_at,
          durationSeconds: Math.max(0, Math.floor(((attempt.ended_at ?? new Date()).getTime() - attempt.started_at.getTime()) / 1000)),
          score: attempt.score,
          earnedMarks: Array.isArray(item.questions_json) ? (item.questions_json as any[]).reduce((sum, question) => sum + ((attempt.answers_json as any)?.[question.id] === question.correct_option_id ? Math.max(1, Number(question.marks) || 1) : 0), 0) : 0,
          totalMarks: Array.isArray(item.questions_json) ? (item.questions_json as any[]).reduce((sum, question) => sum + Math.max(1, Number(question.marks) || 1), 0) : 0,
          passed: attempt.status === 'completed', tabSwitches: attempt.violations,
          browser: attempt.browser || 'Unknown', operatingSystem: attempt.operating_system || 'Unknown',
          ipAddress: attempt.ip_address || 'Unavailable', status: attempt.status,
        })),
      })),
    };
  }

  announcements() {
    return this.prisma.announcements.findMany({ orderBy: { published_at: 'desc' } });
  }

  async messages(email: string) {
    const rows = await this.prisma.admin_student_messages.findMany({
      where: { student_email: email.toLowerCase() },
      orderBy: { sent_at: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({ id: row.id, message: row.message, sentBy: row.sent_by, sentAt: row.sent_at.toISOString(), readAt: row.read_at?.toISOString() ?? null }));
  }

  async readMessage(email: string, id: number) {
    const result = await this.prisma.admin_student_messages.updateMany({
      where: { id, student_email: email.toLowerCase(), read_at: null },
      data: { read_at: new Date() },
    });
    if (!result.count) {
      const exists = await this.prisma.admin_student_messages.findFirst({ where: { id, student_email: email.toLowerCase() } });
      if (!exists) throw new NotFoundException('Notification not found');
    }
    return { read: true, id };
  }

  async readAllMessages(email: string) {
    const result = await this.prisma.admin_student_messages.updateMany({
      where: { student_email: email.toLowerCase(), read_at: null },
      data: { read_at: new Date() },
    });
    return { read: true, count: result.count };
  }

  async clearReadMessages(email: string) {
    const result = await this.prisma.admin_student_messages.deleteMany({
      where: { student_email: email.toLowerCase(), read_at: { not: null } },
    });
    return { cleared: true, count: result.count };
  }

  async portalAccess(email: string) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { email: email.toLowerCase() }, select: { status: true } });
    if (profile?.status !== 'Approved') {
      return { courses_enabled: false, assessments_enabled: false, jobs_enabled: false, profile_status: profile?.status ?? 'Waiting for Student', approval_required: true };
    }
    const row = await this.prisma.portal_access_settings.findUnique({ where: { scope_key: email.toLowerCase() } })
      ?? await this.prisma.portal_access_settings.findUnique({ where: { scope_key: 'global' } });
    return { courses_enabled: Boolean(row?.courses_enabled), assessments_enabled: Boolean(row?.assessments_enabled), jobs_enabled: Boolean(row?.jobs_enabled), profile_status: profile.status, approval_required: false };
  }
  async statistics(email: string) {
    const user = await this.prisma.users.findUnique({ where: { email }, include: { students: true } });
    if (!user) throw new NotFoundException('Student account not found');
    const student = user.students[0];
    const normalizedEmail = email.toLowerCase();
    const [courses, assignments, attempts, availableJobs, applied, profile, courseProgress] = await Promise.all([
      this.courses('active', normalizedEmail),
      this.prisma.assignment_security_settings.findMany({ where: { published: true, active: true, enabled: true } }),
      this.prisma.assignment_attempts.findMany({ where: { student_email: email }, orderBy: [{ started_at: 'desc' }, { id: 'desc' }] }),
      this.availableJobsCount(),
      student ? this.prisma.applications.count({ where: { student_id: student.id, status: 'applied' } }) : 0,
      this.prisma.student_profiles.findUnique({ where: { email: normalizedEmail }, select: { updated_at: true } }),
      this.prisma.admin_snapshots.findMany({ where: { key: { endsWith: `:${normalizedEmail}` } }, select: { updated_at: true } }),
    ]);
    const latest = new Map<string, (typeof attempts)[number]>();
    attempts.forEach((row) => { if (!latest.has(row.assignment_id)) latest.set(row.assignment_id, row); });
    const assignmentMap = new Map(assignments.map((row) => [row.assignment_id, row]));
    let answered = 0; let correct = 0;
    latest.forEach((attempt, id) => {
      const setting = assignmentMap.get(id); if (!setting) return;
      const answers: any = attempt.answers_json ?? {}; answered += Object.keys(answers).length;
      const questions: any[] = Array.isArray(setting.questions_json) ? setting.questions_json as any[] : [];
      correct += questions.filter((q) => answers[q.id] === q.correct_option_id).length;
    });
    const submitted = attempts.filter((row) => ['completed', 'auto_submitted', 'terminated'].includes(row.status));
    const activity = [
      ...attempts.map((row) => row.ended_at ?? row.started_at),
      ...courseProgress.map((row) => row.updated_at),
      ...(profile?.updated_at ? [profile.updated_at] : []),
    ].sort((a, b) => b.getTime() - a.getTime())[0];
    return {
      courses: {
        total: courses.length,
        completed: courses.filter((row) => row.progress_percent >= 100 || row.status.toLowerCase() === 'completed').length,
        active: courses.filter((row) => row.status.toLowerCase() === 'active').length,
        average_completion: Math.round(courses.reduce((sum, row) => sum + Math.max(0, Math.min(100, row.progress_percent)), 0) / Math.max(1, courses.length)),
      },
      assessments: {
        total: assignments.length, attempts: attempts.length, completed: submitted.length,
        average_score: Math.round(submitted.reduce((sum, row) => sum + row.score, 0) / Math.max(1, submitted.length)),
        questions_total: assignments.reduce((sum, row) => sum + (Array.isArray(row.questions_json) ? row.questions_json.length : 0), 0),
        questions_answered: answered, questions_correct: correct, questions_incorrect: Math.max(0, answered - correct),
        duration_seconds: attempts.reduce((sum, row) => sum + Math.max(0, Math.floor(((row.ended_at ?? row.started_at).getTime() - row.started_at.getTime()) / 1000)), 0),
      },
      jobs: { available: availableJobs, applied },
      last_activity: activity?.toISOString() ?? null,
    };
  }

  async legacyLogin(username: string, password: string) {
    const academic = await this.prisma.students.findUnique({ where: { usn: username }, include: { users: true } });
    const user = academic?.users ?? await this.prisma.users.findUnique({ where: { email: username.toLowerCase() } });
    if (!user || !user.is_active || user.role !== 'student' || !await bcrypt.compare(password, user.hashed_password)) {
      throw new UnauthorizedException('Invalid student credentials');
    }
    const security = await this.prisma.student_password_security.upsert({
      where: { user_id: user.id },
      create: { user_id: user.id, must_change_password: true, updated_at: new Date() },
      update: {},
    });
    if (security.must_change_password) {
      return {
        access_token: null, token_type: null, role: 'student', email: user.email,
        password_change_required: true,
        message: 'You must change your temporary password before entering the student portal.',
      };
    }
    const student = academic ?? await this.prisma.students.findFirst({ where: { user_id: user.id } });
    const profile = await this.prisma.student_profiles.findUnique({ where: { email: user.email } });
    return {
      access_token: await this.auth.signToken(user.email, 'student', {
        student_id: student?.id ?? null, profile_id: profile?.id ?? null,
        name: profile?.full_name || user.email,
      }),
      token_type: 'bearer', role: 'student', name: profile?.full_name || user.email,
      profile_status: profile?.status ?? '',
    };
  }

  async studentMe(email: string) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { email } });
    if (!profile) throw new NotFoundException('Student profile not found');
    return this.profileOut(profile);
  }

  async completeProfile(email: string, dto: StudentProfileCompleteDto) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { email } });
    if (!profile) throw new NotFoundException('Student profile not found');
    const updated = await this.prisma.student_profiles.update({
      where: { id: profile.id },
      data: {
        full_name: dto.name, email: dto.email.toLowerCase(), phone: dto.phone,
        course: dto.degree, department: dto.branch, batch: dto.batch,
        status: 'Approval Pending by Admin', tag: 'Profile Completed - Approval Pending', updated_at: new Date(),
      },
    });
    return this.profileOut(updated);
  }

  async courseAssessments(course: string, email: string) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { email: email.toLowerCase() }, select: { batch: true } });
    if (!profile) throw new NotFoundException('Student profile not found');
    const row = await this.prisma.assessment_collections.findUnique({ where: { storage_key: `course:${course}:batch:${profile.batch}` } });
    if (!row) throw new NotFoundException('Course assessments not found');
    return { course_id: course, assessments: JSON.parse(row.payload) };
  }

  async submitCourseAssessment(course: string, submission: Record<string, any>, user: AuthenticatedUser) {
    await this.prisma.assessment_submissions.create({
      data: {
        course_key: course, assessment_id: String(submission.assessmentId ?? ''),
        student_id: user.student_id ?? null, payload: JSON.stringify(submission), submitted_at: new Date(),
      },
    });
    return { saved: true };
  }
}
