import { BadRequestException } from "@nestjs/common";
import JSZip = require("jszip");
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

  it("imports every exam in a wide summary, skips averages, and normalizes roll numbers", async () => {
    const { prisma, service } = fixture();
    prisma.student_profiles.findMany.mockResolvedValue([
      {
        id: 8,
        email: "sneha@cyberlancers.in",
        full_name: "Sneha S",
        first_name: "Sneha",
        registration_number: "2026 - CA08",
      },
    ]);
    const csv = [
      "BATCH ASSESSMENT SUMMARY,,,,",
      "Sl. No.,Roll Number,Student Name,Assessment - 01 (20 Marks),Average,Monthly Assessment - 01",
      "1,2026-CA08,Sneha S,18,18,90",
    ].join("\n");

    const result = await service.importWrittenResults(
      Buffer.from(csv),
      "2026 A",
      "admin@cyberlancers.in",
    );

    expect(result).toMatchObject({ imported: 2, rejected: 0, format: "csv" });
    expect(prisma.written_exam_results.upsert).toHaveBeenCalledTimes(2);
    const creates = prisma.written_exam_results.upsert.mock.calls.map(
      ([argument]) => argument.create,
    );
    expect(creates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exam_name: "Assessment - 01 (20 Marks)",
          max_score: 20,
          score: 18,
        }),
        expect.objectContaining({
          exam_name: "Monthly Assessment - 01",
          max_score: 100,
          score: 90,
        }),
      ]),
    );
  });

  it("reads the visible assessment summary from an XLSX workbook", async () => {
    const { prisma, service } = fixture();
    prisma.student_profiles.findMany.mockResolvedValue([
      {
        id: 1,
        email: "student@cyberlancers.in",
        full_name: "Student Name",
        first_name: "Student",
        registration_number: "2026-CA01",
      },
    ]);
    const zip = new JSZip();
    zip.file(
      "xl/workbook.xml",
      '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Assess - Summary" sheetId="1" r:id="rId1"/></sheets></workbook>',
    );
    zip.file(
      "xl/_rels/workbook.xml.rels",
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    );
    zip.file(
      "xl/worksheets/sheet1.xml",
      '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Roll Number</t></is></c><c r="B1" t="inlineStr"><is><t>Student Name</t></is></c><c r="C1" t="inlineStr"><is><t>Written Test (50 Marks)</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>2026-CA01</t></is></c><c r="B2" t="inlineStr"><is><t>Student Name</t></is></c><c r="C2"><v>42</v></c></row></sheetData></worksheet>',
    );
    const workbook = await zip.generateAsync({ type: "nodebuffer" });

    const result = await service.importWrittenResults(
      workbook,
      "2026 A",
      "admin@cyberlancers.in",
      "assessment.xlsx",
    );

    expect(result).toMatchObject({
      imported: 1,
      rejected: 0,
      format: "xlsx-summary",
    });
    expect(prisma.written_exam_results.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          exam_name: "Written Test (50 Marks)",
          score: 42,
          max_score: 50,
        }),
      }),
    );
  });

  it("includes standalone assessment attempts in the overall batch ranking", async () => {
    const { prisma, service } = fixture();
    prisma.student_profiles.findMany.mockResolvedValue([
      {
        id: 1,
        email: "student@cyberlancers.in",
        full_name: "Student Name",
        first_name: "Student",
        registration_number: "2026-CA01",
      },
    ]);
    prisma.assignment_security_settings.findMany.mockResolvedValue([
      {
        assignment_id: "course:standalone:2026 A:assessment-1",
        assignment_title: "Standalone Assessment",
        questions_json: [{ marks: 10 }],
        published: true,
        active: true,
        created_at: new Date(),
      },
    ]);
    prisma.assignment_attempts.findMany.mockResolvedValue([
      {
        id: 1,
        assignment_id: "course:standalone:2026 A:assessment-1",
        student_email: "student@cyberlancers.in",
        attempt_number: 1,
        score: 80,
        status: "completed",
        started_at: new Date("2026-08-17T10:00:00Z"),
        ended_at: new Date("2026-08-17T10:15:00Z"),
      },
    ]);

    const board = await service.batch("2026 A");

    expect(board.components).toMatchObject({
      courses: 0,
      assessments: 1,
      written_exams: 0,
    });
    expect(board.students[0]).toMatchObject({
      rank: 1,
      score: 80,
      completion_percent: 100,
      attempts: 1,
    });
    expect(board.students[0].attempt_results[0]).toMatchObject({
      source: "assessment",
      assessment_title: "Standalone Assessment",
      score: 80,
      earned_marks: 8,
      max_marks: 10,
    });
  });
});
