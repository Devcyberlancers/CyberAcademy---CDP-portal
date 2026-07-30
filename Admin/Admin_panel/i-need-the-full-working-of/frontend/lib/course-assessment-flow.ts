export type CourseQuestion = {
  id: string;
  text: string;
  type: "MCQ" | "Coding" | "Descriptive";
  marks: number;
  options: string[];
  answer: string;
  diagramUrl?: string;
  diagramName?: string;
};

export type CourseAssessment = {
  id: string;
  module: string;
  title: string;
  passPercent: number;
  requiredToUnlock: boolean;
  questions: CourseQuestion[];
};

export type CourseSubmissionAnswer = {
  questionId: string;
  answer: string;
  awardedMarks: number;
  maxMarks: number;
  correct: boolean;
};

export type CourseAssessmentSubmission = {
  id: string;
  studentName: string;
  registrationNumber: string;
  assessmentId: string;
  assessmentTitle: string;
  module: string;
  submittedAt: string;
  score: number;
  totalMarks: number;
  percent: number;
  passPercent: number;
  status: "Passed" | "Failed";
  answers: CourseSubmissionAnswer[];
};

const defaultCourseId = "ethical-hacking";

export function courseAssessmentStorageKey(courseId = defaultCourseId) {
  return `course-assessment-curriculum-${courseId}-v2`;
}

export function courseModuleQuizStorageKey(courseId = defaultCourseId) {
  return `course-module-quizzes-${courseId}-v2`;
}

export function courseSubmissionStorageKey(courseId = defaultCourseId) {
  return `course-assessment-submissions-${courseId}-v1`;
}

function mcq(id: string, text: string, options: string[], answer: string): CourseQuestion {
  return { id, text, type: "MCQ", marks: 2, options, answer };
}

export const fallbackCourseAssessments: CourseAssessment[] = [
  {
    id: "CA-001",
    module: "Introduction to Ethical Hacking",
    title: "Intro Module Check",
    passPercent: 60,
    requiredToUnlock: true,
    questions: [
      mcq("CQ1", "What is the main purpose of ethical hacking?", ["To identify and report security weaknesses with permission", "To steal confidential data", "To disrupt a network", "To bypass laws"], "To identify and report security weaknesses with permission"),
      mcq("CQ2", "Which document defines the permitted systems, methods, and time window for an engagement?", ["Rules of engagement", "Virus signature", "Source code license", "Incident ticket"], "Rules of engagement"),
      mcq("CQ3", "Which hacker category is authorized by an organization to test its security?", ["White-hat hacker", "Black-hat hacker", "Script kiddie", "Malware author"], "White-hat hacker"),
      mcq("CQ4", "What should an ethical hacker obtain before starting a penetration test?", ["Written authorization", "A leaked password", "A public IP address", "A social-media profile"], "Written authorization"),
      mcq("CQ5", "Which security principle gives a user only the access needed for their job?", ["Least privilege", "Open access", "Security through obscurity", "Default allow"], "Least privilege"),
      mcq("CQ6", "Which phase focuses on collecting publicly available information about a target?", ["Reconnaissance", "Exploitation", "Reporting", "Remediation"], "Reconnaissance"),
      mcq("CQ7", "What is the most appropriate final deliverable after an ethical hacking engagement?", ["A report with findings, evidence, risk, and remediation advice", "The target's passwords", "A public post naming vulnerabilities", "A copy of every file on the target"], "A report with findings, evidence, risk, and remediation advice")
    ]
  },
  {
    id: "CA-002",
    module: "Scanning Networks",
    title: "Scanning Networks Quiz",
    passPercent: 60,
    requiredToUnlock: true,
    questions: [
      mcq("CQ1", "What is the primary purpose of network scanning?", ["To discover hosts, services, and exposed ports", "To erase server logs", "To encrypt a hard drive", "To create user accounts"], "To discover hosts, services, and exposed ports"),
      mcq("CQ2", "Which protocol is commonly used by ping to check host reachability?", ["ICMP", "SMTP", "FTP", "DNS"], "ICMP"),
      mcq("CQ3", "What does an open TCP port generally indicate?", ["A service is listening for connections", "The host is powered off", "The network cable is disconnected", "The port has been deleted"], "A service is listening for connections"),
      mcq("CQ4", "Which port is the default for HTTPS?", ["443", "22", "53", "80"], "443"),
      mcq("CQ5", "Why is service version detection useful during an authorized assessment?", ["It helps identify software that may need patching", "It automatically fixes every vulnerability", "It changes firewall rules", "It hides the scanner"], "It helps identify software that may need patching"),
      mcq("CQ6", "What is a false positive in scan results?", ["A reported issue that is not actually present", "A verified critical vulnerability", "An unscanned host", "An encrypted packet"], "A reported issue that is not actually present"),
      mcq("CQ7", "What should a tester do after identifying an exposed service in scope?", ["Validate it carefully and document the finding", "Immediately exploit it without permission", "Publish the address online", "Disable it without approval"], "Validate it carefully and document the finding")
    ]
  }
];

export function loadCourseAssessments(courseId = defaultCourseId): CourseAssessment[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = window.localStorage.getItem(courseAssessmentStorageKey(courseId));
    const savedModuleQuizzes = window.localStorage.getItem(courseModuleQuizStorageKey(courseId));
    const assessments = saved ? JSON.parse(saved) as CourseAssessment[] : [];
    const moduleQuizzes = savedModuleQuizzes ? JSON.parse(savedModuleQuizzes) as CourseAssessment[] : [];
    const merged = [
      ...(Array.isArray(assessments) ? assessments : []),
      ...(Array.isArray(moduleQuizzes) ? moduleQuizzes : [])
    ];
    return merged;
  } catch {
    return [];
  }
}

export function loadCourseSubmissions(courseId = defaultCourseId): CourseAssessmentSubmission[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = window.localStorage.getItem(courseSubmissionStorageKey(courseId));
    if (!saved) return [];
    const parsed = JSON.parse(saved) as CourseAssessmentSubmission[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function gradeCourseAssessment(
  assessment: CourseAssessment,
  answers: Record<string, string>,
  studentName = "Uppalapati Bhargav",
  registrationNumber = "20BCN7050"
): CourseAssessmentSubmission {
  const gradedAnswers = assessment.questions.map((question) => {
    const answer = answers[question.id] ?? "";
    const correct = answer.trim().toLowerCase() === question.answer.trim().toLowerCase();
    return {
      questionId: question.id,
      answer,
      awardedMarks: correct ? question.marks : 0,
      maxMarks: question.marks,
      correct
    };
  });
  const score = gradedAnswers.reduce((sum, answer) => sum + answer.awardedMarks, 0);
  const totalMarks = assessment.questions.reduce((sum, question) => sum + question.marks, 0);
  const percent = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;

  return {
    id: `SUB-${Date.now()}`,
    studentName,
    registrationNumber,
    assessmentId: assessment.id,
    assessmentTitle: assessment.title,
    module: assessment.module,
    submittedAt: new Date().toLocaleString(),
    score,
    totalMarks,
    percent,
    passPercent: assessment.passPercent,
    status: percent >= assessment.passPercent ? "Passed" : "Failed",
    answers: gradedAnswers
  };
}

export function saveCourseSubmission(submission: CourseAssessmentSubmission, courseId = defaultCourseId) {
  if (typeof window === "undefined") return;
  const submissions = loadCourseSubmissions(courseId);
  window.localStorage.setItem(courseSubmissionStorageKey(courseId), JSON.stringify([submission, ...submissions]));
}
