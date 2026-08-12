import {
  ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException,
} from '@nestjs/common';
import {
  assignment_attempts_status, assignment_security_settings_violation_policy, Prisma,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CloseAttemptDto, EventDto, SaveAnswerDto, StartAttemptDto } from './dto/assessment.dto';
import { NativeAssessmentDto } from './dto/assessment.dto';

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private collectionKey(kind: string, course?: string, batch?: string) {
    const scope = batch?.trim() || '2026 A';
    return `${course ? `${kind}:${course}` : kind}:batch:${scope}`;
  }

  private async collection(kind: string, course?: string, batch?: string) {
    const storage_key = this.collectionKey(kind, course, batch);
    const row = await this.prisma.assessment_collections.findUnique({ where: { storage_key } });
    if (!row) throw new NotFoundException('Assessment collection not found');
    const value = JSON.parse(row.payload);
    return Array.isArray(value) ? value : [];
  }

  async getCollection(kind: string, course?: string, batch?: string) {
    return { assessments: await this.collection(kind, course, batch) };
  }

  private nativeId(course: string, assessment: string) {
    const raw = `course:${course}:${assessment}`;
    return raw.length <= 80 ? raw : `course:${course.slice(0, 40)}:${createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
  }

  private questions(items: any[]) {
    return (items ?? []).map((question, index) => {
      const id = String(question.id || `q${index + 1}`);
      const raw = Array.isArray(question.options) && question.options.length >= 2 ? question.options : ['Correct', 'Incorrect'];
      const options = raw.map((option: any, optionIndex: number) =>
        typeof option === 'object' && option.id
          ? { id: String(option.id), text: String(option.text ?? '') }
          : { id: `o${optionIndex + 1}`, text: String(option) });
      const answer = String(question.answer || question.correctAnswer || question.correct_option_id || '');
      const correct = options.find((option: { id: string; text: string }) => option.id === answer || option.text.trim().toLowerCase() === answer.trim().toLowerCase())?.id
        ?? options[0].id;
      return { id, text: String(question.text || question.title || `Question ${index + 1}`), options, correct_option_id: correct, marks: Math.max(1, Number(question.marks) || 1) };
    });
  }

  private settingData(id: string, item: any, published: boolean) {
    const now = new Date();
    return {
      assignment_title: String(item.title || 'Assessment'),
      duration_minutes: Math.max(1, Number(item.durationMinutes || 30)),
      max_attempts: Math.max(1, Math.min(20, Number(item.maxAttempts || 1))),
      published, active: published, enabled: true, questions_json: this.questions(item.questions || []),
      require_fullscreen: true, end_on_fullscreen_exit: true, end_on_tab_switch: true, end_on_blur: true,
      disable_right_click: true, disable_copy: true, disable_paste: true, disable_cut: true,
      disable_drag: true, disable_text_selection: true, disable_printing: true, disable_save_page: true,
      disable_inspect_shortcuts: true, randomize_question_order: true, randomize_option_order: true,
      auto_save_answers: true, auto_submit_on_timer_end: true, log_device_info: true,
      log_browser_info: true, log_ip_address: true, log_session_changes: true,
      violation_policy: assignment_security_settings_violation_policy.end_exam,
      available_from: null, available_until: null, resume_allowed: true,
      created_at: now, updated_at: now,
    } satisfies Omit<Prisma.assignment_security_settingsUncheckedCreateInput, 'assignment_id'>;
  }

  async saveCollection(kind: 'standalone' | 'course', assessments: any[], course?: string, batch?: string) {
    const selectedBatch = batch?.trim() || '2026 A';
    const storage_key = this.collectionKey(kind, course, selectedBatch);
    const courseRow = course && /^\d+$/.test(course) ? await this.prisma.courses.findUnique({ where: { id: Number(course) } }) : null;
    const published = kind === 'standalone' || Boolean(courseRow && ['active', 'published'].includes(courseRow.status));
    const namespace = `${course ?? 'standalone'}:${selectedBatch}`;
    const ids = assessments.map((item) => this.nativeId(namespace, String(item.id || 'assessment')));
    await this.prisma.$transaction(async (tx) => {
      await tx.assessment_collections.upsert({
        where: { storage_key },
        create: { storage_key, kind, course_key: course ?? null, payload: JSON.stringify(assessments), updated_at: new Date() },
        update: { payload: JSON.stringify(assessments), updated_at: new Date() },
      });
      for (let index = 0; index < assessments.length; index++) {
        const id = ids[index];
        const data = this.settingData(id, assessments[index], published);
        await tx.assignment_security_settings.upsert({
          where: { assignment_id: id },
          create: { assignment_id: id, ...data },
          update: { ...data, created_at: undefined },
        });
      }
      await tx.assignment_security_settings.deleteMany({
        where: { assignment_id: { startsWith: `course:${namespace}:`, notIn: ids } },
      });
      if (courseRow) await tx.courses.update({ where: { id: courseRow.id }, data: { assessments: assessments.length, updated_at: new Date() } });
    });
    return { saved: true };
  }

  private security(item: any) {
    return {
      enabled: item.enabled, requireFullscreen: item.require_fullscreen,
      endOnFullscreenExit: item.end_on_fullscreen_exit, endOnTabSwitch: item.end_on_tab_switch,
      endOnBlur: item.end_on_blur, disableRightClick: item.disable_right_click,
      disableCopy: item.disable_copy, disablePaste: item.disable_paste, disableCut: item.disable_cut,
      disableDrag: item.disable_drag, disableTextSelection: item.disable_text_selection,
      disablePrinting: item.disable_printing, disableSavePage: item.disable_save_page,
      disableInspectShortcuts: item.disable_inspect_shortcuts,
      randomizeQuestionOrder: item.randomize_question_order, randomizeOptionOrder: item.randomize_option_order,
      autoSaveAnswers: item.auto_save_answers, autoSubmitOnTimerEnd: item.auto_submit_on_timer_end,
      logDeviceInfo: item.log_device_info, logBrowserInfo: item.log_browser_info,
      logIpAddress: item.log_ip_address, logSessionChanges: item.log_session_changes,
      violationPolicy: item.violation_policy,
    };
  }

  async assignments(email?: string, requestedAssignmentId?: string) {
    const profile = email ? await this.prisma.student_profiles.findUnique({ where: { email: email.toLowerCase() }, select: { batch: true } }) : null;
    const batch = profile?.batch ?? '2026 A';
    const collection = await this.prisma.assessment_collections.findUnique({ where: { storage_key: this.collectionKey('standalone', undefined, batch) } });
    const current = collection ? JSON.parse(collection.payload) : [];
    const currentIds = Array.isArray(current) ? current.flatMap((item: any) => {
      const id = String(item.id || 'assessment');
      const scoped = this.nativeId(`standalone:${batch}`, id);
      return batch === '2026 A' ? [scoped, this.nativeId('standalone', id)] : [scoped];
    }) : [];
    const assignmentIds = requestedAssignmentId ? [requestedAssignmentId] : currentIds;
    const rows = await this.prisma.assignment_security_settings.findMany({
      where: { assignment_id: { in: assignmentIds }, published: true, active: true },
      orderBy: { created_at: 'desc' },
    });
    const allAttempts = email && rows.length ? await this.prisma.assignment_attempts.findMany({
      where: { assignment_id: { in: rows.map((item) => item.assignment_id) }, student_email: email.toLowerCase() },
      orderBy: { started_at: 'asc' },
    }) : [];
    const attemptsByAssignment = new Map<string, typeof allAttempts>();
    for (const attempt of allAttempts) attemptsByAssignment.set(attempt.assignment_id, [...(attemptsByAssignment.get(attempt.assignment_id) ?? []), attempt]);
    return rows.map((item) => {
      const attempts = attemptsByAssignment.get(item.assignment_id) ?? [];
      const latest = attempts[attempts.length - 1];
      const max = item.max_attempts ?? 3;
      const remaining = Math.max(max - attempts.length, 0);
      return {
        assignmentId: item.assignment_id, title: item.assignment_title, durationMinutes: item.duration_minutes,
        safeMode: item.enabled, resumeAllowed: item.resume_allowed, maxAttempts: max,
        attemptsUsed: attempts.length, remainingAttempts: remaining,
        latestAttemptStatus: latest?.status ?? null, latestAttemptId: latest?.id ?? null,
        canStart: remaining > 0 || Boolean(latest?.status === 'in_progress' && item.resume_allowed),
        questionCount: Array.isArray(item.questions_json) ? item.questions_json.length : 0,
        attempts: attempts.map((attempt) => this.summary(attempt, item.assignment_title)),
        security: this.security(item),
      };
    });
  }

  private shuffled<T>(items: T[], enabled: boolean) {
    const result = [...items];
    if (enabled) for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  async start(assignmentId: string, dto: StartAttemptDto, ip: string, userAgent: string) {
    const assignment = await this.prisma.assignment_security_settings.findUnique({ where: { assignment_id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assessment not found');
    const now = new Date();
    if (!assignment.published || !assignment.active || (assignment.available_from && now < assignment.available_from)
      || (assignment.available_until && now > assignment.available_until)) {
      throw new ForbiddenException({ error: 'ASSESSMENT_NOT_AVAILABLE', message: 'This assessment is not currently available.' });
    }
    const attempts = await this.prisma.assignment_attempts.findMany({
      where: { assignment_id: assignmentId, student_email: dto.email },
      orderBy: { started_at: 'desc' },
    });
    const existing = attempts[0];
    if (existing?.status === 'in_progress') {
      if (assignment.resume_allowed) return this.attemptResponse(assignment, existing, 'resume');
      throw new ConflictException({ error: 'ACTIVE_ATTEMPT', message: 'You already have an assessment in progress.', resume_allowed: false, attempt_id: existing.id });
    }
    if (attempts.length >= (assignment.max_attempts ?? 3)) {
      throw new ConflictException({ error: 'NO_ATTEMPTS_LEFT', message: existing?.status === 'completed' ? 'Assignment already completed. No attempts remaining.' : 'You have used all available attempts.' });
    }
    const questions: any[] = Array.isArray(assignment.questions_json) ? assignment.questions_json as any[] : [];
    const questionOrder = this.shuffled(questions.map((q) => q.id), assignment.randomize_question_order);
    const optionOrder = Object.fromEntries(questions.map((q) => [q.id, this.shuffled((q.options ?? []).map((o: any) => o.id), assignment.randomize_option_order)]));
    const student = await this.prisma.students.findFirst({ where: { users: { email: dto.email } } });
    const attempt = await this.prisma.assignment_attempts.create({
      data: {
        assignment_id: assignmentId, student_email: dto.email, student_id: student?.id ?? null,
        attempt_number: attempts.length + 1, status: assignment_attempts_status.in_progress,
        started_at: now, ended_at: null, termination_reason: null, auto_submitted: false, violations: 0,
        browser: dto.device.browser, operating_system: dto.device.operating_system,
        screen_resolution: dto.device.screen_resolution, user_agent: dto.device.user_agent || userAgent,
        ip_address: ip, question_order_json: questionOrder, option_order_json: optionOrder,
        answers_json: {}, score: 0,
      },
    });
    await this.event(attempt.id, { event_type: 'ATTEMPT_STARTED', reason: '', details: { assignmentId, attemptNumber: attempts.length + 1 } });
    return this.attemptResponse(assignment, attempt, 'start');
  }

  private publicQuestions(assignment: any, attempt: any) {
    const questions: any[] = Array.isArray(assignment.questions_json) ? assignment.questions_json : [];
    const byId = new Map(questions.map((q) => [q.id, q]));
    const order: any[] = Array.isArray(attempt.question_order_json) ? attempt.question_order_json : [];
    const optionOrder: any = attempt.option_order_json ?? {};
    return order.map((id) => {
      const question = byId.get(id); const options = new Map((question?.options ?? []).map((o: any) => [o.id, o]));
      return { id, text: question?.text, options: (optionOrder[id] ?? []).map((oid: string) => options.get(oid)).filter(Boolean).map((o: any) => ({ id: o.id, text: o.text })) };
    });
  }

  private async attemptResponse(assignment: any, attempt: any, action = 'resume') {
    const events = await this.prisma.assignment_events.findMany({ where: { attempt_id: attempt.id }, orderBy: { created_at: 'desc' } });
    const endsAt = new Date(attempt.started_at.getTime() + assignment.duration_minutes * 60_000);
    return {
      action, attemptId: attempt.id, attemptNumber: attempt.attempt_number, assignmentId: assignment.assignment_id,
      title: assignment.assignment_title, durationMinutes: assignment.duration_minutes,
      maxAttempts: assignment.max_attempts, resumeAllowed: assignment.resume_allowed, status: attempt.status,
      startedAt: attempt.started_at, endedAt: attempt.ended_at, terminationReason: attempt.termination_reason,
      autoSubmitted: attempt.auto_submitted, violations: attempt.violations, score: attempt.score,
      answers: attempt.answers_json ?? {}, questions: this.publicQuestions(assignment, attempt),
      security: this.security(assignment),
      events: events.map((event) => ({ eventType: event.event_type, reason: event.reason, createdAt: event.created_at })),
      endsAt, remainingSeconds: Math.max(0, Math.floor((endsAt.getTime() - Date.now()) / 1000)),
    };
  }

  async saveAnswer(id: number, dto: SaveAnswerDto) {
    const attempt = await this.prisma.assignment_attempts.findUnique({ where: { id } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status !== 'in_progress') throw new ConflictException('Attempt is already closed');
    const answers: any = { ...(attempt.answers_json as any ?? {}), [dto.question_id]: dto.option_id };
    await this.prisma.$transaction([
      this.prisma.assignment_attempts.update({ where: { id }, data: { answers_json: answers } }),
      this.prisma.assignment_events.create({ data: { attempt_id: id, event_type: 'ANSWER_SAVED', reason: dto.question_id, details_json: { clientTimestamp: dto.client_timestamp ?? null }, created_at: new Date() } }),
    ]);
    return { ok: true, answersSaved: Object.keys(answers).length };
  }

  async event(id: number, dto: EventDto) {
    if (!await this.prisma.assignment_attempts.findUnique({ where: { id } })) throw new NotFoundException('Attempt not found');
    await this.prisma.assignment_events.create({ data: { attempt_id: id, event_type: dto.event_type, reason: dto.reason, details_json: dto.details, created_at: new Date() } });
    return { ok: true };
  }

  private score(questions: any[], answers: Record<string, string>) {
    const totalMarks = questions.reduce((sum, question) => sum + Math.max(1, Number(question.marks) || 1), 0);
    const earnedMarks = questions.reduce((sum, question) => sum + (answers[question.id] === question.correct_option_id ? Math.max(1, Number(question.marks) || 1) : 0), 0);
    return totalMarks ? Math.round((earnedMarks / totalMarks) * 100) : 0;
  }

  async close(id: number, dto: CloseAttemptDto, terminate = false) {
    const attempt = await this.prisma.assignment_attempts.findUnique({ where: { id } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    const assignment = await this.prisma.assignment_security_settings.findUnique({ where: { assignment_id: attempt.assignment_id } });
    if (!assignment) throw new NotFoundException('Assessment not found');
    if (attempt.status !== 'in_progress') return this.attemptResponse(assignment, attempt);
    const answers = { ...(attempt.answers_json as any ?? {}), ...dto.answers };
    const status = terminate ? assignment_attempts_status.terminated
      : dto.auto_submitted ? assignment_attempts_status.auto_submitted : assignment_attempts_status.completed;
    const updated = await this.prisma.assignment_attempts.update({
      where: { id },
      data: {
        answers_json: answers, status, ended_at: new Date(), auto_submitted: dto.auto_submitted,
        termination_reason: terminate ? dto.reason : dto.auto_submitted ? 'TIMER_EXPIRED' : null,
        violations: terminate ? attempt.violations + 1 : attempt.violations,
        score: this.score(Array.isArray(assignment.questions_json) ? assignment.questions_json as any[] : [], answers),
      },
    });
    await this.event(id, { event_type: terminate ? 'ATTEMPT_TERMINATED' : 'ATTEMPT_SUBMITTED', reason: dto.reason, details: { autoSubmitted: dto.auto_submitted } });
    return this.attemptResponse(assignment, updated);
  }

  private summary(attempt: any, title = '') {
    const ended = attempt.ended_at ?? new Date();
    return {
      attemptId: attempt.id, studentId: attempt.student_id, studentEmail: attempt.student_email,
      assignmentId: attempt.assignment_id, assignmentTitle: title, attemptNumber: attempt.attempt_number,
      status: attempt.status, startedAt: attempt.started_at, endedAt: attempt.ended_at,
      durationSeconds: Math.floor((ended.getTime() - attempt.started_at.getTime()) / 1000),
      terminationReason: attempt.termination_reason, autoSubmitted: attempt.auto_submitted,
      violations: attempt.violations, score: attempt.score,
      answeredCount: Object.keys(attempt.answers_json as any ?? {}).length, browser: attempt.browser,
      operatingSystem: attempt.operating_system, screenResolution: attempt.screen_resolution,
      userAgent: attempt.user_agent, ipAddress: attempt.ip_address,
      riskLevel: attempt.status === 'terminated' || attempt.violations > 1 ? 'red' : attempt.violations ? 'yellow' : 'green',
    };
  }

  async attempts() {
    const rows = await this.prisma.assignment_attempts.findMany({ orderBy: { started_at: 'desc' } });
    return rows.map((row) => {
      const summary = this.summary(row);
      return {
        attemptId: summary.attemptId, assignmentId: summary.assignmentId, studentEmail: summary.studentEmail,
        startedAt: summary.startedAt, endedAt: summary.endedAt, durationSeconds: summary.durationSeconds,
        status: summary.status, autoSubmitted: summary.autoSubmitted, terminationReason: summary.terminationReason,
        violations: summary.violations, browser: summary.browser, device: summary.operatingSystem,
        ipAddress: summary.ipAddress, riskLevel: summary.riskLevel, score: summary.score,
      };
    });
  }

  async adminAttempts(filters: { assignment?: string; status?: string; email?: string; scope?: string; batch?: string; page: number; size: number }) {
    let scopedAssignmentIds: string[] | undefined;
    if (filters.scope === 'standalone') {
      const collection = await this.prisma.assessment_collections.findUnique({ where: { storage_key: this.collectionKey('standalone', undefined, filters.batch) } });
      const current = collection ? JSON.parse(collection.payload) : [];
      scopedAssignmentIds = Array.isArray(current)
        ? current.flatMap((item: any) => {
          const id = String(item.id || 'assessment');
          const batch = filters.batch?.trim() || '2026 A';
          const scoped = this.nativeId(`standalone:${batch}`, id);
          return batch === '2026 A' ? [scoped, this.nativeId('standalone', id)] : [scoped];
        })
        : [];
    }
    const batchEmails = filters.batch ? (await this.prisma.student_profiles.findMany({ where: { batch: filters.batch.trim() }, select: { email: true } })).map((profile) => profile.email.toLowerCase()) : undefined;
    const where: Prisma.assignment_attemptsWhereInput = {
      ...(filters.assignment ? { assignment_id: filters.assignment } : {}),
      ...(scopedAssignmentIds ? { assignment_id: { in: scopedAssignmentIds } } : {}),
      ...(filters.status ? { status: filters.status as assignment_attempts_status } : {}),
      ...(filters.email ? { student_email: { contains: filters.email } } : batchEmails ? { student_email: { in: batchEmails } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.assignment_attempts.count({ where }),
      this.prisma.assignment_attempts.findMany({ where, orderBy: { started_at: 'desc' }, skip: (filters.page - 1) * filters.size, take: filters.size }),
    ]);
    const ids = [...new Set(rows.map((row) => row.assignment_id))];
    const assignments = await this.prisma.assignment_security_settings.findMany({ where: { assignment_id: { in: ids } } });
    const titles = new Map(assignments.map((row) => [row.assignment_id, row.assignment_title]));
    return { page: filters.page, pageSize: filters.size, total, totalPages: total ? Math.ceil(total / filters.size) : 0, items: rows.map((row) => this.summary(row, titles.get(row.assignment_id))) };
  }

  private answerRows(assignment: any, attempt: any) {
    const answers: any = attempt.answers_json ?? {};
    const questions: any[] = Array.isArray(assignment.questions_json) ? assignment.questions_json : [];
    return questions.map((question, index) => {
      const selected = answers[question.id];
      const selectedOption = question.options?.find((o: any) => o.id === selected);
      const correctOption = question.options?.find((o: any) => o.id === question.correct_option_id);
      return {
        questionNumber: index + 1, questionId: question.id, question: question.text,
        selectedOptionId: selected ?? null, selectedAnswer: selectedOption?.text ?? null,
        correctOptionId: question.correct_option_id, correctAnswer: correctOption?.text ?? null,
        isCorrect: selected === question.correct_option_id, answered: selected !== undefined,
      };
    });
  }

  async attemptDetail(id: number, answersOnly = false) {
    const attempt = await this.prisma.assignment_attempts.findUnique({ where: { id } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    const assignment = await this.prisma.assignment_security_settings.findUnique({ where: { assignment_id: attempt.assignment_id } });
    if (!assignment) throw new NotFoundException('Assessment not found');
    const answers = this.answerRows(assignment, attempt);
    if (answersOnly) return { attemptId: id, studentEmail: attempt.student_email, assignmentId: attempt.assignment_id, assignmentTitle: assignment.assignment_title, score: attempt.score, answers };
    const events = await this.prisma.assignment_events.findMany({ where: { attempt_id: id }, orderBy: { created_at: 'asc' } });
    return {
      ...this.summary(attempt, assignment.assignment_title),
      questions: Array.isArray(assignment.questions_json) ? assignment.questions_json.length : 0,
      answers,
      events: events.map((event) => ({ eventId: event.id, eventType: event.event_type, reason: event.reason, details: event.details_json ?? {}, createdAt: event.created_at })),
    };
  }

  async nativeAssessments() {
    const rows = await this.prisma.assignment_security_settings.findMany({ orderBy: { updated_at: 'desc' } });
    return rows.map((item) => ({
      id: item.id, assignment_id: item.assignment_id, assignment_title: item.assignment_title,
      duration_minutes: item.duration_minutes, published: item.published, active: item.active,
      resume_allowed: item.resume_allowed, max_attempts: item.max_attempts,
      question_count: Array.isArray(item.questions_json) ? item.questions_json.length : 0,
      updated_at: item.updated_at,
    }));
  }

  async upsertNative(dto: NativeAssessmentDto) {
    if (!['warning', 'auto_submit', 'end_exam'].includes(dto.violation_policy)) {
      throw new UnprocessableEntityException('Invalid violation_policy');
    }
    const base = this.settingData(dto.assignment_id, {
      title: dto.assignment_title, durationMinutes: dto.duration_minutes,
      maxAttempts: dto.max_attempts, questions: dto.questions,
    }, dto.published);
    const row = await this.prisma.assignment_security_settings.upsert({
      where: { assignment_id: dto.assignment_id },
      create: {
        assignment_id: dto.assignment_id, ...base, active: dto.active,
        available_from: dto.available_from ? new Date(dto.available_from) : null,
        available_until: dto.available_until ? new Date(dto.available_until) : null,
        resume_allowed: dto.resume_allowed, enabled: dto.enabled,
        require_fullscreen: dto.require_fullscreen, end_on_fullscreen_exit: dto.end_on_fullscreen_exit,
        end_on_tab_switch: dto.end_on_tab_switch, end_on_blur: dto.end_on_blur,
        randomize_question_order: dto.randomize_question_order, randomize_option_order: dto.randomize_option_order,
        auto_save_answers: dto.auto_save_answers, auto_submit_on_timer_end: dto.auto_submit_on_timer_end,
        violation_policy: dto.violation_policy as assignment_security_settings_violation_policy,
      },
      update: {
        ...base, created_at: undefined, active: dto.active,
        available_from: dto.available_from ? new Date(dto.available_from) : null,
        available_until: dto.available_until ? new Date(dto.available_until) : null,
        resume_allowed: dto.resume_allowed, enabled: dto.enabled,
        require_fullscreen: dto.require_fullscreen, end_on_fullscreen_exit: dto.end_on_fullscreen_exit,
        end_on_tab_switch: dto.end_on_tab_switch, end_on_blur: dto.end_on_blur,
        randomize_question_order: dto.randomize_question_order, randomize_option_order: dto.randomize_option_order,
        auto_save_answers: dto.auto_save_answers, auto_submit_on_timer_end: dto.auto_submit_on_timer_end,
        violation_policy: dto.violation_policy as assignment_security_settings_violation_policy,
      },
    });
    return { ok: true, assignment_id: row.assignment_id, id: row.id };
  }
}
