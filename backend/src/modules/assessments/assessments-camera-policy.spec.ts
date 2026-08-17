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
});
