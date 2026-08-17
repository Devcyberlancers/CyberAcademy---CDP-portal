import { BadRequestException } from "@nestjs/common";
import { LeaderboardsService } from "./leaderboards.service";

describe("LeaderboardsService", () => {
  function fixture() {
    const prisma = {
      student_profiles: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      courses: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      admin_snapshots: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      assignment_security_settings: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      assignment_attempts: { findMany: jest.fn().mockResolvedValue([]) },
      written_exam_results: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    return { prisma, service: new LeaderboardsService(prisma as any) };
  }

  it("ranks a completed course test and calculates full completion", async () => {
    const { prisma, service } = fixture();
    prisma.courses.findUnique.mockResolvedValue({
      id: 1,
      title: "Security Foundations",
      metadata_json: { target_batch: "2026 A" },
    });
    prisma.student_profiles.findMany.mockResolvedValue([
      {
        id: 1,
        email: "alice@cyberlancers.in",
        full_name: "Alice",
        first_name: "Alice",
        registration_number: "CA001",
      },
      {
        id: 2,
        email: "bob@cyberlancers.in",
        full_name: "Bob",
        first_name: "Bob",
        registration_number: "CA002",
      },
    ]);
    prisma.admin_snapshots.findUnique.mockResolvedValue({
      payload: JSON.stringify([
        { quiz: "Module 1", generatedQuestions: [{ id: "q1", marks: 5 }] },
      ]),
    });
    prisma.admin_snapshots.findMany.mockResolvedValue([
      {
        key: "course-progress:1:alice@cyberlancers.in",
        payload: JSON.stringify({
          quizzes: {
            0: {
              attempts: [
                {
                  attemptNumber: 1,
                  score: 80,
                  earnedMarks: 4,
                  status: "completed",
                },
              ],
            },
          },
        }),
      },
    ]);

    const board = await service.course(1, "2026 A");

    expect(board.topper).toMatchObject({
      student_name: "Alice",
      score: 80,
      rank: 1,
    });
    expect(board.students[0]).toMatchObject({
      student_name: "Alice",
      completion_percent: 100,
      attempts: 1,
      rank: 1,
    });
    expect(board.students[1]).toMatchObject({
      student_name: "Bob",
      completion_percent: 0,
      score: 0,
      rank: 2,
    });
  });

  it("imports valid written results and reports invalid rows without losing the valid row", async () => {
    const { prisma, service } = fixture();
    prisma.student_profiles.findMany.mockResolvedValue([
      {
        id: 1,
        email: "student@cyberlancers.in",
        full_name: "Student Name",
        first_name: "Student",
        registration_number: "CA001",
      },
    ]);
    prisma.courses.findMany.mockResolvedValue([
      {
        id: 9,
        title: "Cybersecurity",
        metadata_json: { target_batch: "2026 A" },
      },
    ]);
    const csv = [
      "batch,course_id,exam_name,student_email,attempt_number,score,max_score,attempted_at",
      "2026 A,9,Written Midterm,STUDENT@CYBERLANCERS.IN,1,42,50,2026-08-13 10:00",
      "2026 A,9,Written Midterm,missing@cyberlancers.in,1,40,50,2026-08-13 10:00",
    ].join("\n");

    const result = await service.importWrittenResults(
      Buffer.from(csv),
      "2026 A",
      "admin@cyberlancers.in",
    );

    expect(result).toMatchObject({ imported: 1, rejected: 1 });
    expect(prisma.written_exam_results.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.audit_logs.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a CSV without a student identity column", async () => {
    const { service } = fixture();
    const csv = "exam_name,score,max_score\nWritten Midterm,42,50";

    await expect(
      service.importWrittenResults(
        Buffer.from(csv),
        "2026 A",
        "admin@cyberlancers.in",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
