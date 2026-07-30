import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import * as bcrypt from 'bcryptjs';
import {
  ApplicationStatusDto,
  JobSearchPreferenceDto,
  StudentProfileDto,
  StudentProfileCompleteDto,
} from './dto/student-portal.dto';

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
      platform: job.platform,
      match_score: job.match_score,
      is_entry_level: job.is_entry_level,
      created_at: job.created_at,
    };
  }

  private safeLimit(value: number | undefined, fallback = 500, max = 1000) {
    const limit = Number(value ?? fallback);
    if (!Number.isInteger(limit) || limit < 1 || limit > max) {
      throw new BadRequestException(`limit must be between 1 and ${max}`);
    }
    return limit;
  }

  companies() {
    return this.prisma.companies.findMany({ orderBy: { name: 'asc' } });
  }

  async jobs(limit?: number, extra: Prisma.jobsWhereInput = {}) {
    const rows = await this.prisma.jobs.findMany({
      where: { is_entry_level: true, ...extra },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: this.safeLimit(limit),
    });
    return rows.map((row) => this.jobOut(row));
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
    delete result.updated_at;
    delete result.personal_email;
    return result;
  }

  async getProfile(email: string) {
    const profile = await this.prisma.student_profiles.findUnique({ where: { email: email.toLowerCase() } });
    if (!profile) throw new NotFoundException('Student profile not found');
    return this.profileOut(profile);
  }

  async saveProfile(dto: StudentProfileDto) {
    const email = dto.email.toLowerCase();
    const required = [dto.full_name, dto.registration_number, dto.phone, dto.course, dto.department];
    const status = required.every((value) => value.trim()) ? 'Completed' : 'Waiting for Student';
    const firstName = dto.first_name || dto.full_name.trim().split(/\s+/)[0] || '';
    const profile = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.student_profiles.upsert({
        where: { email },
        create: { ...dto, email, first_name: firstName, status, updated_at: new Date() },
        update: { ...dto, email, first_name: firstName, status, updated_at: new Date() },
      });
      const user = await tx.users.findUnique({ where: { email }, include: { students: true } });
      const student = user?.students[0];
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
        await tx.students.update({
          where: { id: student.id },
          data: {
            department_id: departmentId,
            full_name: dto.full_name || student.full_name,
            usn: (dto.registration_number || dto.cyberlancers_id || student.usn).slice(0, 40),
            resume_url: dto.resume_url || student.resume_url,
            skills: dto.tag || student.skills,
          },
        });
      }
      return saved;
    });
    return this.profileOut(profile);
  }

  courses(status = 'active') {
    return this.prisma.courses.findMany({
      where: status ? { status } : {},
      orderBy: { updated_at: 'desc' },
      select: {
        id: true, title: true, heading: true, category: true, level: true, status: true,
        progress_percent: true, assessments: true, labs: true, start_date: true, end_date: true,
        icon: true, color: true, metadata_json: true, updated_at: true,
      },
    }).then((rows) => rows.map(({ metadata_json, ...row }) => ({ ...row, metadata: metadata_json ?? {} })));
  }

  private async snapshot(key: string, fallback: unknown) {
    const row = await this.prisma.admin_snapshots.findUnique({ where: { key } });
    if (!row) return fallback;
    try { return JSON.parse(row.payload); } catch { return fallback; }
  }

  async courseContent(courseId: number) {
    const course = await this.prisma.courses.findUnique({ where: { id: courseId } });
    if (!course || !['active', 'published'].includes(course.status)) {
      throw new NotFoundException('Published course not found');
    }
    const [modules, banner, assessments] = await Promise.all([
      this.snapshot(`course-editor-modules-${courseId}-v2`, []),
      this.snapshot(`course-editor-banner-${courseId}-v1`, {}),
      this.prisma.assignment_security_settings.findMany({
        where: { assignment_id: { startsWith: `course:${courseId}:` }, published: true, active: true },
        orderBy: { created_at: 'asc' },
      }),
    ]);
    return {
      course: {
        id: course.id, title: course.title, heading: course.heading, category: course.category,
        level: course.level, status: course.status, metadata: course.metadata_json ?? {}, banner,
      },
      modules: Array.isArray(modules) ? modules : [],
      assessments: assessments.map((item) => ({
        assignmentId: item.assignment_id,
        title: item.assignment_title,
        durationMinutes: item.duration_minutes,
        maxAttempts: item.max_attempts,
        questionCount: Array.isArray(item.questions_json) ? item.questions_json.length : 0,
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
    return rows.map((row) => ({ id: row.id, message: row.message, sentBy: row.sent_by, sentAt: row.sent_at.toISOString() }));
  }

  async portalAccess(email: string) {
    const row = await this.prisma.portal_access_settings.findUnique({ where: { scope_key: email.toLowerCase() } })
      ?? await this.prisma.portal_access_settings.findUnique({ where: { scope_key: 'global' } });
    return {
      courses_enabled: Boolean(row?.courses_enabled),
      assessments_enabled: Boolean(row?.assessments_enabled),
      jobs_enabled: Boolean(row?.jobs_enabled),
    };
  }

  async getPreference(email: string) {
    const row = await this.prisma.student_job_search_preferences.findUnique({ where: { student_email: email.toLowerCase() } });
    return { search_time_ist: row?.search_time_ist ?? '09:00', active: row?.active ?? false, last_run_on: row?.last_run_on ?? null };
  }

  async savePreference(email: string, dto: JobSearchPreferenceDto) {
    const row = await this.prisma.student_job_search_preferences.upsert({
      where: { student_email: email.toLowerCase() },
      create: { student_email: email.toLowerCase(), ...dto, updated_at: new Date() },
      update: { ...dto, updated_at: new Date() },
    });
    return { search_time_ist: row.search_time_ist, active: row.active, last_run_on: row.last_run_on };
  }

  async statistics(email: string) {
    const user = await this.prisma.users.findUnique({ where: { email }, include: { students: true } });
    if (!user) throw new NotFoundException('Student account not found');
    const student = user.students[0];
    const [courses, assignments, attempts, availableJobs, applied] = await Promise.all([
      this.prisma.courses.findMany({ where: { status: { not: 'deleted' } } }),
      this.prisma.assignment_security_settings.findMany({ where: { published: true, active: true, enabled: true } }),
      this.prisma.assignment_attempts.findMany({ where: { student_email: email }, orderBy: [{ started_at: 'desc' }, { id: 'desc' }] }),
      this.prisma.jobs.count(),
      student ? this.prisma.applications.count({ where: { student_id: student.id, status: 'applied' } }) : 0,
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
      ...courses.map((row) => row.updated_at),
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
        status: 'Completed', tag: 'Profile Completed - Approval Pending', updated_at: new Date(),
      },
    });
    return this.profileOut(updated);
  }

  async courseAssessments(course: string) {
    const row = await this.prisma.assessment_collections.findUnique({ where: { storage_key: `course:${course}` } });
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
