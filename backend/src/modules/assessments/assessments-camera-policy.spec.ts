import { AssessmentsService } from "./assessments.service";

describe("assessment camera and violation policy", () => {
  function fixture() {
    const transactionClient = {
      assessment_collections: { upsert: jest.fn().mockResolvedValue({}) },
      assignment_security_settings: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      courses: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      courses: { findUnique: jest.fn().mockResolvedValue(null) },
      assignment_attempts: {
        findUnique: jest.fn().mockResolvedValue({ id: 7 }),
        update: jest.fn().mockResolvedValue({}),
      },
      assignment_events: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      $transaction: jest.fn((value: unknown) => {
        if (typeof value === "function") return value(transactionClient);
        return Promise.all(value as Promise<unknown>[]);
      }),
    };
    return {
      service: new AssessmentsService(prisma as any),
      prisma,
      transactionClient,
    };
  }

  it("persists camera approval independently for every assessment", async () => {
    const { service, transactionClient } = fixture();

    await service.saveCollection(
      "standalone",
      [
        {
          id: "ASM-1",
          title: "Camera optional test",
          cameraRequired: false,
          questions: [
            { id: "q1", text: "Question", options: ["A", "B"], answer: "A" },
          ],
        },
      ],
      undefined,
      "2026 A",
    );

    expect(
      transactionClient.assignment_security_settings.upsert,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ camera_enabled: false }),
        update: expect.objectContaining({ camera_enabled: false }),
      }),
    );
  });

  it("increments the stored violation total only for warning and critical events", async () => {
    const { service, prisma } = fixture();

    await service.events(7, [
      {
        event_type: "PHONE_DETECTED",
        details: { severity: "warning", warningNumber: 1 },
      },
      { event_type: "PERSON_DETECTED", details: { severity: "info" } },
      {
        event_type: "PHONE_DETECTED",
        details: { severity: "critical", warningNumber: 4 },
      },
    ]);

    expect(prisma.assignment_attempts.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { violations: { increment: 2 } },
    });
  });

  it("loads a 100-student assessment history with fixed batched queries", async () => {
    const startedAt = new Date("2026-08-17T08:00:00.000Z");
    const rows = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      student_id: index + 1,
      student_email: `student${index + 1}@cyberlancers.in`,
      assignment_id: "standalone:2026 A:ASM-LOAD",
      attempt_number: 1,
      status: "completed",
      started_at: startedAt,
      ended_at: new Date(startedAt.getTime() + 60000),
      termination_reason: null,
      auto_submitted: false,
      violations: 0,
      score: 80,
      answers_json: { q1: "o1" },
      browser: "Chrome",
      operating_system: "Windows",
      screen_resolution: "1920x1080",
      user_agent: "test",
      ip_address: "203.0.113.1",
    }));
    const prisma = {
      assignment_attempts: {
        count: jest.fn().mockResolvedValue(rows.length),
        findMany: jest.fn().mockResolvedValue(rows),
      },
      assignment_security_settings: {
        findMany: jest.fn().mockResolvedValue([
          {
            assignment_id: "standalone:2026 A:ASM-LOAD",
            assignment_title: "Load Test",
          },
        ]),
      },
      student_profiles: {
        findMany: jest.fn().mockResolvedValue(
          rows.map((row, index) => ({
            email: row.student_email,
            full_name: `Student ${index + 1}`,
            registration_number: `CA${index + 1}`,
          })),
        ),
      },
    };
    const service = new AssessmentsService(prisma as any);

    const result = await service.adminAttempts({ page: 1, size: 100 });

    expect(result.items).toHaveLength(100);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        studentName: "Student 1",
        registrationNumber: "CA1",
        assignmentTitle: "Load Test",
      }),
    );
    expect(prisma.assignment_security_settings.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.student_profiles.findMany).toHaveBeenCalledTimes(1);
  });
});
