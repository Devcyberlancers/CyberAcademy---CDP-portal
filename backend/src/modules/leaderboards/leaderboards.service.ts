import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type AttemptRow = {
  source: "course_test" | "written_exam";
  assessment_id: string;
  assessment_title: string;
  attempt_number: number;
  score: number;
  earned_marks: number;
  max_marks: number;
  status: string;
  attempted_at: Date | string | null;
};
type RankedStudent = {
  student_id: number;
  student_name: string;
  student_email: string;
  registration_number: string;
  score: number;
  completion_percent: number;
  attempts: number;
  rank?: number;
};

@Injectable()
export class LeaderboardsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireBatch(value?: string) {
    const batch = value?.trim().replace(/\s+/g, " ") ?? "";
    if (!/^\d{4}\s+[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(batch)) {
      throw new UnprocessableEntityException(
        "A valid selected batch is required",
      );
    }
    return batch;
  }
  private round(value: number) {
    return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
  }
  private rank<T extends RankedStudent>(rows: T[]) {
    const ranked = rows as Array<T & { rank: number }>;
    ranked.sort(
      (a, b) =>
        b.score - a.score ||
        b.completion_percent - a.completion_percent ||
        a.attempts - b.attempts ||
        a.student_name.localeCompare(b.student_name),
    );
    let currentRank = 0;
    let previous = "";
    ranked.forEach((row, index) => {
      const signature = [row.score, row.completion_percent, row.attempts].join(
        "|",
      );
      if (signature !== previous) currentRank = index + 1;
      row.rank = currentRank;
      previous = signature;
    });
    return ranked;
  }
  private parsePayload(payload?: string | null) {
    try {
      const parsed = payload ? JSON.parse(payload) : {};
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, any>)
        : {};
    } catch {
      return {};
    }
  }

  async courseForStudent(courseId: number, email: string) {
    const profile = await this.prisma.student_profiles.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { batch: true },
    });
    if (!profile) throw new NotFoundException("Student profile not found");
    return this.studentView(await this.course(courseId, profile.batch, email));
  }
  async batchForStudent(email: string) {
    const profile = await this.prisma.student_profiles.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { batch: true },
    });
    if (!profile) throw new NotFoundException("Student profile not found");
    return this.studentView(await this.batch(profile.batch, email));
  }

  private studentView<T extends { students: Array<Record<string, any>> }>(
    board: T,
  ) {
    return {
      ...board,
      students: board.students.map(
        ({ student_email: _studentEmail, ...student }) => student,
      ),
    };
  }

  async course(
    courseId: number,
    requestedBatch?: string,
    currentStudentEmail?: string,
  ) {
    const batch = this.requireBatch(requestedBatch);
    const course = await this.prisma.courses.findUnique({
      where: { id: courseId },
    });
    if (!course || (course.metadata_json as any)?.target_batch !== batch) {
      throw new NotFoundException("Course not found in selected batch");
    }
    const prefix = "course:" + courseId + ":";
    const progressPrefix = "course-progress:" + courseId + ":";
    const [
      profiles,
      moduleRow,
      progressRows,
      settings,
      databaseAttempts,
      writtenResults,
    ] = await Promise.all([
      this.prisma.student_profiles.findMany({
        where: { batch },
        orderBy: [{ full_name: "asc" }, { id: "asc" }],
      }),
      this.prisma.admin_snapshots.findUnique({
        where: { key: "course-editor-modules-" + courseId + "-v2" },
      }),
      this.prisma.admin_snapshots.findMany({
        where: { key: { startsWith: progressPrefix } },
      }),
      this.prisma.assignment_security_settings.findMany({
        where: {
          assignment_id: { startsWith: prefix },
          published: true,
          active: true,
        },
        orderBy: { created_at: "asc" },
      }),
      this.prisma.assignment_attempts.findMany({
        where: { assignment_id: { startsWith: prefix } },
        orderBy: [{ started_at: "asc" }, { id: "asc" }],
      }),
      this.prisma.written_exam_results.findMany({
        where: { batch, course_id: courseId },
        orderBy: [{ attempted_at: "asc" }, { id: "asc" }],
      }),
    ]);
    let modules: Array<Record<string, any>> = [];
    try {
      const parsed = moduleRow ? JSON.parse(moduleRow.payload) : [];
      modules = Array.isArray(parsed) ? parsed : [];
    } catch {
      modules = [];
    }
    const moduleComponents = modules
      .map((module, index) => ({
        id: "module:" + index,
        index,
        title: String(
          module.quiz || module.title || "Module " + (index + 1) + " Test",
        ),
        questions: Array.isArray(module.generatedQuestions)
          ? module.generatedQuestions
          : [],
      }))
      .filter((component) => component.questions.length > 0);
    const assessmentComponents = settings
      .filter((setting) => !setting.assignment_id.includes(":module-"))
      .map((setting) => ({
        id: setting.assignment_id,
        title: setting.assignment_title,
        maxMarks: Array.isArray(setting.questions_json)
          ? (setting.questions_json as any[]).reduce(
              (sum, question) =>
                sum + Math.max(1, Number(question?.marks) || 1),
              0,
            )
          : 100,
      }));
    const writtenNames = [
      ...new Set(writtenResults.map((row) => row.exam_name)),
    ].sort();
    const totalComponents =
      moduleComponents.length +
      assessmentComponents.length +
      writtenNames.length;
    const progressByEmail = new Map(
      progressRows.map((row) => [
        row.key.slice(progressPrefix.length).toLowerCase(),
        this.parsePayload(row.payload),
      ]),
    );
    const attemptsByEmail = new Map<string, typeof databaseAttempts>();
    databaseAttempts.forEach((attempt) => {
      const key = attempt.student_email.toLowerCase();
      attemptsByEmail.set(key, [...(attemptsByEmail.get(key) ?? []), attempt]);
    });
    const writtenByEmail = new Map<string, typeof writtenResults>();
    writtenResults.forEach((result) => {
      const key = result.student_email.toLowerCase();
      writtenByEmail.set(key, [...(writtenByEmail.get(key) ?? []), result]);
    });
    const students = profiles.map((profile) => {
      const email = profile.email.toLowerCase();
      const progress = progressByEmail.get(email) ?? {};
      const storedAttempts = attemptsByEmail.get(email) ?? [];
      const studentWritten = writtenByEmail.get(email) ?? [];
      const attemptResults: AttemptRow[] = [];
      const componentBest: number[] = [];
      let completedComponents = 0;
      moduleComponents.forEach((component) => {
        const quiz = progress.quizzes?.[String(component.index)];
        const raw = Array.isArray(quiz?.attempts)
          ? quiz.attempts
          : quiz?.submitted_at
            ? [
                {
                  attemptNumber: 1,
                  score: quiz.score,
                  status: "completed",
                  endedAt: quiz.submitted_at,
                },
              ]
            : [];
        const maxMarks = component.questions.reduce(
          (sum, q) => sum + Math.max(1, Number(q?.marks) || 1),
          0,
        );
        raw.forEach((attempt: any, index: number) => {
          const score = Math.max(0, Math.min(100, Number(attempt.score) || 0));
          attemptResults.push({
            source: "course_test",
            assessment_id: component.id,
            assessment_title: component.title,
            attempt_number: Math.max(
              1,
              Number(attempt.attemptNumber) || index + 1,
            ),
            score: this.round(score),
            earned_marks: this.round(
              Number.isFinite(Number(attempt.earnedMarks))
                ? Number(attempt.earnedMarks)
                : (score / 100) * maxMarks,
            ),
            max_marks: maxMarks,
            status: String(attempt.status || "completed"),
            attempted_at:
              attempt.endedAt ||
              attempt.startedAt ||
              quiz?.submitted_at ||
              null,
          });
        });
        const completed = raw.filter(
          (attempt: any) => attempt.status !== "in_progress",
        );
        componentBest.push(
          completed.length
            ? Math.max(
                ...completed.map((attempt: any) => Number(attempt.score) || 0),
              )
            : 0,
        );
        if (completed.length) completedComponents += 1;
      });
      assessmentComponents.forEach((component) => {
        const rows = storedAttempts.filter(
          (attempt) => attempt.assignment_id === component.id,
        );
        rows.forEach((attempt) => {
          const score = Math.max(0, Math.min(100, Number(attempt.score) || 0));
          attemptResults.push({
            source: "course_test",
            assessment_id: component.id,
            assessment_title: component.title,
            attempt_number: Math.max(1, Number(attempt.attempt_number) || 1),
            score: this.round(score),
            earned_marks: this.round((score / 100) * component.maxMarks),
            max_marks: component.maxMarks,
            status: attempt.status,
            attempted_at: attempt.ended_at ?? attempt.started_at,
          });
        });
        const completed = rows.filter(
          (attempt) => attempt.status !== "in_progress",
        );
        componentBest.push(
          completed.length
            ? Math.max(
                ...completed.map((attempt) => Number(attempt.score) || 0),
              )
            : 0,
        );
        if (completed.length) completedComponents += 1;
      });
      writtenNames.forEach((examName) => {
        const rows = studentWritten.filter(
          (result) => result.exam_name === examName,
        );
        rows.forEach((result) => {
          const percent =
            result.max_score > 0 ? (result.score / result.max_score) * 100 : 0;
          attemptResults.push({
            source: "written_exam",
            assessment_id: "written:" + result.id,
            assessment_title: result.exam_name,
            attempt_number: result.attempt_number,
            score: this.round(percent),
            earned_marks: this.round(result.score),
            max_marks: this.round(result.max_score),
            status: "completed",
            attempted_at: result.attempted_at ?? result.imported_at,
          });
        });
        componentBest.push(
          rows.length
            ? Math.max(
                ...rows.map((result) =>
                  result.max_score > 0
                    ? (result.score / result.max_score) * 100
                    : 0,
                ),
              )
            : 0,
        );
        if (rows.length) completedComponents += 1;
      });
      attemptResults.sort(
        (a, b) =>
          new Date(b.attempted_at ?? 0).getTime() -
          new Date(a.attempted_at ?? 0).getTime(),
      );
      const onlineCount = moduleComponents.length + assessmentComponents.length;
      const onlineBest = componentBest.slice(0, onlineCount);
      const writtenBest = componentBest.slice(onlineCount);
      return {
        student_id: profile.id,
        student_name: profile.full_name || profile.first_name || profile.email,
        student_email: profile.email,
        registration_number: profile.registration_number,
        score: this.round(
          totalComponents
            ? componentBest.reduce((sum, value) => sum + value, 0) /
                totalComponents
            : 0,
        ),
        online_score: onlineBest.length
          ? this.round(
              onlineBest.reduce((sum, value) => sum + value, 0) /
                onlineBest.length,
            )
          : null,
        written_score: writtenBest.length
          ? this.round(
              writtenBest.reduce((sum, value) => sum + value, 0) /
                writtenBest.length,
            )
          : null,
        completion_percent: totalComponents
          ? Math.round((completedComponents / totalComponents) * 100)
          : 0,
        completed_components: completedComponents,
        total_components: totalComponents,
        attempts: attemptResults.length,
        attempt_results: attemptResults,
        is_current_student: currentStudentEmail
          ? email === currentStudentEmail.toLowerCase()
          : false,
      };
    });
    const ranked = this.rank(students);
    const topper = ranked.find((student) => student.attempts > 0) ?? null;
    return {
      scope: "course",
      batch,
      course: { id: course.id, title: course.title },
      generated_at: new Date().toISOString(),
      topper: topper
        ? {
            rank: topper.rank,
            student_id: topper.student_id,
            student_name: topper.student_name,
            registration_number: topper.registration_number,
            score: topper.score,
          }
        : null,
      components: {
        course_tests: moduleComponents.length + assessmentComponents.length,
        written_exams: writtenNames.length,
        total: totalComponents,
      },
      students: ranked,
    };
  }

  async batch(requestedBatch?: string, currentStudentEmail?: string) {
    const batch = this.requireBatch(requestedBatch);
    const [profiles, courses, standaloneWritten] = await Promise.all([
      this.prisma.student_profiles.findMany({
        where: { batch },
        orderBy: [{ full_name: "asc" }, { id: "asc" }],
      }),
      this.prisma.courses.findMany({
        where: { status: { in: ["active", "published"] } },
        orderBy: { title: "asc" },
      }),
      this.prisma.written_exam_results.findMany({
        where: { batch, course_id: null },
        orderBy: [{ attempted_at: "asc" }, { id: "asc" }],
      }),
    ]);
    const scopedCourses = courses.filter(
      (course) => (course.metadata_json as any)?.target_batch === batch,
    );
    const courseBoards = await Promise.all(
      scopedCourses.map((course) =>
        this.course(course.id, batch, currentStudentEmail),
      ),
    );
    const rankedCourseBoards = courseBoards.filter(
      (board) => board.components.total > 0,
    );
    const writtenNames = [
      ...new Set(standaloneWritten.map((row) => row.exam_name)),
    ].sort();
    const students = profiles.map((profile) => {
      const email = profile.email.toLowerCase();
      const courseScores = rankedCourseBoards.map((board) => {
        const row = board.students.find(
          (student) => student.student_email.toLowerCase() === email,
        );
        return {
          course_id: board.course.id,
          course_title: board.course.title,
          rank: row?.rank ?? null,
          score: row?.score ?? 0,
          completion_percent: row?.completion_percent ?? 0,
          attempts: row?.attempts ?? 0,
        };
      });
      const written = standaloneWritten.filter(
        (row) => row.student_email.toLowerCase() === email,
      );
      const writtenScores = writtenNames.map((name) => {
        const rows = written.filter((row) => row.exam_name === name);
        return rows.length
          ? Math.max(
              ...rows.map((row) =>
                row.max_score > 0 ? (row.score / row.max_score) * 100 : 0,
              ),
            )
          : 0;
      });
      const componentScores = [
        ...courseScores.map((item) => item.score),
        ...writtenScores,
      ];
      const completed =
        courseScores.filter((item) => item.completion_percent >= 100).length +
        writtenNames.filter((name) =>
          written.some((row) => row.exam_name === name),
        ).length;
      const writtenAttempts: AttemptRow[] = written.map((result) => ({
        source: "written_exam",
        assessment_id: "written:" + result.id,
        assessment_title: result.exam_name,
        attempt_number: result.attempt_number,
        score: this.round(
          result.max_score > 0 ? (result.score / result.max_score) * 100 : 0,
        ),
        earned_marks: this.round(result.score),
        max_marks: this.round(result.max_score),
        status: "completed",
        attempted_at: result.attempted_at ?? result.imported_at,
      }));
      return {
        student_id: profile.id,
        student_name: profile.full_name || profile.first_name || profile.email,
        student_email: profile.email,
        registration_number: profile.registration_number,
        score: this.round(
          componentScores.length
            ? componentScores.reduce((sum, value) => sum + value, 0) /
                componentScores.length
            : 0,
        ),
        completion_percent: componentScores.length
          ? Math.round((completed / componentScores.length) * 100)
          : 0,
        attempts:
          courseScores.reduce((sum, item) => sum + item.attempts, 0) +
          written.length,
        course_scores: courseScores,
        attempt_results: writtenAttempts,
        written_exam_score: writtenScores.length
          ? this.round(
              writtenScores.reduce((sum, value) => sum + value, 0) /
                writtenScores.length,
            )
          : null,
        is_current_student: currentStudentEmail
          ? email === currentStudentEmail.toLowerCase()
          : false,
      };
    });
    const ranked = this.rank(students);
    const topper = ranked.find((student) => student.attempts > 0) ?? null;
    return {
      scope: "batch",
      batch,
      generated_at: new Date().toISOString(),
      topper: topper
        ? {
            rank: topper.rank,
            student_id: topper.student_id,
            student_name: topper.student_name,
            registration_number: topper.registration_number,
            score: topper.score,
          }
        : null,
      components: {
        courses: rankedCourseBoards.length,
        written_exams: writtenNames.length,
      },
      students: ranked,
    };
  }

  writtenExamTemplate() {
    return [
      "batch,course_id,course_title,exam_name,student_email,registration_number,student_name,attempt_number,score,max_score,attempted_at",
      "2026 A,1,Cybersecurity Fundamentals,Written Midterm,student@cyberlancers.in,CA001,Student Name,1,42,50,2026-08-13 10:00",
      "2026 A,,,Batch Aptitude Test,student@cyberlancers.in,CA001,Student Name,1,78,100,2026-08-13 14:00",
    ].join("\r\n");
  }

  async importWrittenResults(
    file: Buffer | undefined,
    requestedBatch: string | undefined,
    actor: string,
  ) {
    const batch = this.requireBatch(requestedBatch);
    if (!file?.length)
      throw new BadRequestException("Select a CSV file to import");
    if (file.length > 5 * 1024 * 1024)
      throw new BadRequestException("CSV file must be 5 MB or smaller");
    const parsed = this.parseCsv(file.toString("utf8"));
    if (parsed.length < 2)
      throw new BadRequestException(
        "CSV must contain a header and at least one result row",
      );
    if (parsed.length > 5001)
      throw new BadRequestException(
        "A single import supports up to 5,000 result rows",
      );
    const headers = parsed[0].map((header) => this.normalizeHeader(header));
    const missing = ["exam_name", "score", "max_score"].filter(
      (header) => !headers.includes(header),
    );
    if (missing.length)
      throw new BadRequestException(
        "Missing required CSV columns: " + missing.join(", "),
      );
    if (
      !headers.includes("student_email") &&
      !headers.includes("registration_number")
    ) {
      throw new BadRequestException(
        "CSV requires student_email or registration_number",
      );
    }
    const [profiles, courses] = await Promise.all([
      this.prisma.student_profiles.findMany({ where: { batch } }),
      this.prisma.courses.findMany(),
    ]);
    const scopedCourses = courses.filter(
      (course) => (course.metadata_json as any)?.target_batch === batch,
    );
    const byEmail = new Map(
      profiles.map((profile) => [profile.email.toLowerCase(), profile]),
    );
    const byRegistration = new Map(
      profiles.map((profile) => [
        profile.registration_number.trim().toLowerCase(),
        profile,
      ]),
    );
    const courseById = new Map(
      scopedCourses.map((course) => [course.id, course]),
    );
    const courseByTitle = new Map(
      scopedCourses.map((course) => [
        course.title.trim().toLowerCase(),
        course,
      ]),
    );
    const errors: Array<{ row: number; message: string }> = [];
    const records: Array<{
      batch: string;
      course_key: string;
      course_id: number | null;
      exam_name: string;
      student_email: string;
      registration_number: string;
      student_name: string;
      attempt_number: number;
      score: number;
      max_score: number;
      attempted_at: Date | null;
      imported_at: Date;
      imported_by: string;
    }> = [];
    parsed.slice(1).forEach((cells, index) => {
      const rowNumber = index + 2;
      if (!cells.some((cell) => cell.trim())) return;
      const value = (name: string) =>
        cells[headers.indexOf(name)]?.trim() ?? "";
      try {
        const csvBatch = value("batch");
        if (csvBatch && csvBatch.toLowerCase() !== batch.toLowerCase())
          throw new Error("row belongs to another batch");
        const email = value("student_email").toLowerCase();
        const registration = value("registration_number").toLowerCase();
        const profile =
          (email ? byEmail.get(email) : undefined) ??
          (registration ? byRegistration.get(registration) : undefined);
        if (!profile)
          throw new Error("student is not present in the selected batch");
        if (email && profile.email.toLowerCase() !== email)
          throw new Error(
            "email and registration number identify different students",
          );
        const rawCourseId = value("course_id");
        const rawCourseTitle = value("course_title");
        const selectedCourse = rawCourseId
          ? courseById.get(Number(rawCourseId))
          : rawCourseTitle
            ? courseByTitle.get(rawCourseTitle.toLowerCase())
            : undefined;
        if ((rawCourseId || rawCourseTitle) && !selectedCourse)
          throw new Error("course is not present in the selected batch");
        const examName = value("exam_name");
        if (!examName) throw new Error("exam_name is required");
        const score = Number(value("score"));
        const maxScore = Number(value("max_score"));
        if (
          !Number.isFinite(score) ||
          !Number.isFinite(maxScore) ||
          maxScore <= 0 ||
          score < 0 ||
          score > maxScore
        ) {
          throw new Error("score must be between 0 and max_score");
        }
        const attemptNumber = value("attempt_number")
          ? Number(value("attempt_number"))
          : 1;
        if (
          !Number.isInteger(attemptNumber) ||
          attemptNumber < 1 ||
          attemptNumber > 100
        )
          throw new Error("invalid attempt_number");
        const rawDate = value("attempted_at");
        const attemptedAt = rawDate ? new Date(rawDate) : null;
        if (attemptedAt && Number.isNaN(attemptedAt.getTime()))
          throw new Error("invalid attempted_at");
        records.push({
          batch,
          course_key: selectedCourse ? "course:" + selectedCourse.id : "batch",
          course_id: selectedCourse?.id ?? null,
          exam_name: examName,
          student_email: profile.email.toLowerCase(),
          registration_number: profile.registration_number,
          student_name:
            profile.full_name || profile.first_name || profile.email,
          attempt_number: attemptNumber,
          score,
          max_score: maxScore,
          attempted_at: attemptedAt,
          imported_at: new Date(),
          imported_by: actor,
        });
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : "Invalid row",
        });
      }
    });
    for (let offset = 0; offset < records.length; offset += 250) {
      const chunk = records.slice(offset, offset + 250);
      await this.prisma.$transaction(
        chunk.map((record) =>
          this.prisma.written_exam_results.upsert({
            where: {
              batch_course_key_exam_name_student_email_attempt_number: {
                batch: record.batch,
                course_key: record.course_key,
                exam_name: record.exam_name,
                student_email: record.student_email,
                attempt_number: record.attempt_number,
              },
            },
            create: record,
            update: {
              course_id: record.course_id,
              registration_number: record.registration_number,
              student_name: record.student_name,
              score: record.score,
              max_score: record.max_score,
              attempted_at: record.attempted_at,
              imported_at: record.imported_at,
              imported_by: record.imported_by,
            },
          }),
        ),
      );
    }
    if (records.length) {
      await this.prisma.audit_logs.create({
        data: {
          actor_email: actor,
          action: "WRITTEN_EXAM_RESULTS_IMPORTED",
          target_type: "batch",
          target_id: batch,
          details: JSON.stringify({
            imported: records.length,
            rejected: errors.length,
          }),
          created_at: new Date(),
        },
      });
    }
    return { imported: records.length, rejected: errors.length, errors };
  }

  private normalizeHeader(value: string) {
    const clean = value
      .replace(String.fromCharCode(65279), "")
      .trim()
      .toLowerCase();
    const normalized = clean.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const aliases: Record<string, string> = {
      email: "student_email",
      login_mail: "student_email",
      registration_no: "registration_number",
      register_number: "registration_number",
      usn: "registration_number",
      name: "student_name",
      marks: "score",
      maximum_marks: "max_score",
      total_marks: "max_score",
      exam: "exam_name",
      course: "course_title",
      attempt: "attempt_number",
      date: "attempted_at",
    };
    return aliases[normalized] ?? normalized;
  }

  private parseCsv(text: string) {
    const rows: string[][] = [];
    let row: string[] = [];
    let value = "";
    let quoted = false;
    const quote = String.fromCharCode(34);
    const lineFeed = String.fromCharCode(10);
    const carriageReturn = String.fromCharCode(13);
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === quote) {
        if (quoted && text[index + 1] === quote) {
          value += quote;
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === "," && !quoted) {
        row.push(value);
        value = "";
      } else if (
        (character === lineFeed || character === carriageReturn) &&
        !quoted
      ) {
        if (character === carriageReturn && text[index + 1] === lineFeed)
          index += 1;
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
      } else {
        value += character;
      }
    }
    if (quoted)
      throw new BadRequestException("CSV contains an unclosed quoted field");
    if (value.length || row.length) {
      row.push(value);
      rows.push(row);
    }
    return rows;
  }
}
