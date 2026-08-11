import {
  BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import { PrismaService } from '../../prisma/prisma.service';

const LIMIT = 2;
const WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const TECH = ['python', 'java', 'javascript', 'typescript', 'react', 'node', 'sql', 'linux', 'aws', 'azure', 'docker', 'kubernetes', 'siem', 'splunk', 'soc', 'network security', 'cybersecurity', 'penetration testing', 'incident response'];
const ACTIONS = ['built', 'developed', 'implemented', 'analyzed', 'secured', 'automated', 'monitored', 'investigated'];

@Injectable()
export class ResumeAnalysisService {
  private readonly logger = new Logger(ResumeAnalysisService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private async student(email: string) {
    const row = await this.prisma.students.findFirst({ where: { users: { email } }, include: { users: true } });
    if (!row) throw new ForbiddenException('A valid Student account is required for resume analysis.');
    return row;
  }

  async quota(email: string) {
    const student = await this.student(email);
    const start = new Date(Date.now() - WINDOW_MS);
    const rows = await this.prisma.resume_analyses.findMany({
      where: { student_id: student.id, created_at: { gte: start } },
      orderBy: { created_at: 'asc' },
    });
    return {
      limit: LIMIT, used: rows.length, remaining: Math.max(0, LIMIT - rows.length), window_days: 3,
      resets_at: rows.length >= LIMIT ? new Date(rows[0].created_at.getTime() + WINDOW_MS).toISOString() : null,
    };
  }

  private async extract(filename: string, buffer: Buffer) {
    if (filename.toLowerCase().endsWith('.pdf')) {
      const parser = new PDFParse({ data: buffer });
      try { return (await parser.getText()).text.trim(); } finally { await parser.destroy(); }
    }
    if (filename.toLowerCase().endsWith('.docx')) return (await mammoth.extractRawText({ buffer })).value.trim();
    throw new UnsupportedMediaTypeException('Upload a PDF or DOCX resume.');
  }

  private scores(text: string) {
    const lower = text.toLowerCase();
    const words = text.match(/[a-zA-Z][a-zA-Z+#.-]*/g) ?? [];
    const sections = ['summary', 'education', 'experience', 'projects', 'skills'];
    const formatting = Math.min(10, 4 + sections.filter((s) => lower.includes(s)).length + (words.length >= 350 && words.length <= 950 ? 1 : 0));
    const grammar = Math.min(10, 5 + (/[.!?]/.test(text) ? 2 : 0) + (text.length > 300 ? 2 : 0));
    const projects = Math.min(20, (lower.includes('project') ? 10 : 0) + ACTIONS.filter((v) => lower.includes(v)).length);
    const skills = Math.min(20, (lower.includes('skill') ? 8 : 0) + TECH.filter((v) => lower.includes(v)).length);
    const experience = Math.min(20, (/(experience|internship)/.test(lower) ? 8 : 0) + (/(analyst|engineer|developer|trainee)/.test(lower) ? 5 : 0) + ACTIONS.filter((v) => lower.includes(v)).length);
    const education = Math.min(10, (lower.includes('education') ? 7 : 0) + (/(b\.?tech|bachelor|degree|college|university|cgpa)/.test(lower) ? 3 : 0));
    const keywords = Math.min(10, TECH.filter((v) => lower.includes(v)).length);
    const score = Math.min(100, formatting + grammar + projects + skills + experience + education + keywords);
    return {
      score, ats_score: score, grammar_score: grammar * 10, formatting_score: formatting * 10,
      skills_score: skills * 5, projects_score: projects * 5, experience_score: experience * 5,
      education_score: education * 10,
    };
  }

  private response(text: string, scores: ReturnType<ResumeAnalysisService['scores']>) {
    const present = TECH.filter((item) => text.toLowerCase().includes(item));
    const deductions = [
      ...(!/summary/i.test(text) ? [{ section: 'Professional Summary', reason: 'Summary section is missing or unclear', lost_points: 2, suggestion: 'Add a concise role-focused summary.', current_text: 'Not clearly present in resume.', suggested_text: 'Professional Summary\\nAdd your role focus, tools, and strongest project area.', potential_gain: 2, current_score: 0, max_score: 10, priority: 'medium' }] : []),
      ...(!/projects/i.test(text) ? [{ section: 'Projects', reason: 'Projects section is not clearly labelled', lost_points: 4, suggestion: 'Add a dedicated Projects section.', current_text: 'Not clearly present in resume.', suggested_text: 'Projects\\n- Describe technologies, scope, and outcome.', potential_gain: 4, current_score: 0, max_score: 20, priority: 'high' }] : []),
      ...(present.length < 8 ? [{ section: 'Skills', reason: 'Skills section has too few ATS keywords', lost_points: 3, suggestion: 'Group existing technical skills clearly.', current_text: present.join(', ') || 'Not clearly present in resume.', suggested_text: `Technical Skills: ${present.join(', ') || 'Add tools already present in your resume.'}`, potential_gain: 3, current_score: scores.skills_score / 5, max_score: 20, priority: 'high' }] : []),
    ];
    const gain = Math.min(100 - scores.score, deductions.reduce((sum, row) => sum + row.potential_gain, 0));
    return {
      ...scores,
      roadmap: { current_score: scores.score, potential_score: scores.score + gain, total_gain: gain, estimated_time: `${Math.max(10, deductions.length * 5)}-${Math.max(15, deductions.length * 5 + 5)} Minutes`, deductions },
      summary: 'Resume analyzed with deterministic ATS rules. AI suggestions are temporarily unavailable.',
      strengths: ['Structured resume text was successfully extracted.'],
      weaknesses: ['Improve missing or weak resume sections shown in the roadmap.'],
      missing_keywords: [], missing_skills: [],
      career_roles: ['Cybersecurity Analyst', 'SOC Analyst', 'Information Security Associate'],
      suggestions: ['Add measurable impact, relevant tools, and missing resume sections where applicable.'],
      section_improvements: [],
    };
  }

  private async aiResponse(text: string, deterministic: Record<string, unknown>) {
    const apiKey = this.config.get<string>('nvidia.apiKey');
    if (!apiKey) {
      this.logger.warn('NVIDIA_API_KEY is not configured; returning deterministic ATS analysis.');
      return null;
    }
    const prompt = [
      'Improve resume quality from the text only. Do not invent skills, metrics, tools, companies, or experience.',
      'Do not calculate scores. Return JSON with keys: summary, strengths, weaknesses, missing_keywords, missing_skills, career_roles, suggestions, section_improvements.',
      'section_improvements must contain objects with section, current_text, suggested_text, and reason.',
      `Context: ${JSON.stringify(deterministic)}`,
      `Resume text:\n${text.slice(0, 3200)}`,
    ].join('\n');
    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          model: this.config.get<string>('nvidia.model'),
          temperature: 0.2,
          max_tokens: 650,
          messages: [
            { role: 'system', content: 'You analyze resumes. Do not calculate scores. Do not invent facts. Return JSON only.' },
            { role: 'user', content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (response.status !== HttpStatus.OK) {
        const providerMessage = (await response.text().catch(() => '')).slice(0, 500);
        this.logger.warn(`NVIDIA resume analysis returned HTTP ${response.status}: ${providerMessage || 'No response body'}`);
        return null;
      }
      const payload: any = await response.json();
      const content = String(payload.choices?.[0]?.message?.content ?? '').trim();
      const unfenced = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const start = unfenced.indexOf('{');
      const end = unfenced.lastIndexOf('}');
      if (start < 0 || end <= start) {
        this.logger.warn('NVIDIA resume analysis did not return a JSON object.');
        return null;
      }
      const parsed = JSON.parse(unfenced.slice(start, end + 1));
      const arrayKeys = ['strengths', 'weaknesses', 'missing_keywords', 'missing_skills', 'career_roles', 'suggestions', 'section_improvements'];
      const arrays = Object.fromEntries(arrayKeys.map((key) => [key, Array.isArray(parsed[key]) ? parsed[key] : []])) as Record<string, unknown[]>;
      const result = { summary: String(parsed.summary ?? ''), ...arrays };
      return result.summary || Object.values(arrays).some((items) => items.length) ? result : null;
    } catch (error) {
      this.logger.warn(`NVIDIA resume analysis failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async analyze(email: string, filename: string, buffer: Buffer) {
    const student = await this.student(email);
    const quota = await this.quota(email);
    if (quota.remaining <= 0) throw new HttpException(`Resume analysis limit reached. You can analyze again after ${quota.resets_at}.`, HttpStatus.TOO_MANY_REQUESTS);
    const text = await this.extract(filename, buffer);
    if (!text) throw new HttpException('No readable text was found in this resume.', HttpStatus.BAD_REQUEST);
    const scores = this.scores(text);
    const deterministic = this.response(text, scores);
    const ai = await this.aiResponse(text, {
      scores, present_keywords: TECH.filter((item) => text.toLowerCase().includes(item)),
      word_count: (text.match(/[a-zA-Z][a-zA-Z+#.-]*/g) ?? []).length,
      roadmap_deductions: deterministic.roadmap.deductions.slice(0, 8),
    });
    const result = { ...(ai ? { ...deterministic, ...ai } : deterministic), ai_enhanced: Boolean(ai), analysis_mode: ai ? 'ai_enhanced' : 'deterministic' };
    await this.prisma.resume_analyses.create({
      data: {
        student_id: student.id, resume_filename: filename, resume_text: text,
        overall_score: scores.score, ats_score: scores.ats_score, grammar_score: scores.grammar_score,
        formatting_score: scores.formatting_score, projects_score: scores.projects_score,
        skills_score: scores.skills_score, experience_score: scores.experience_score,
        education_score: scores.education_score, ai_response_json: JSON.stringify(result),
        created_at: new Date(),
      },
    });
    return { ...result, quota: await this.quota(email) };
  }

  async analyzeProfile(email: string, requestedEmail?: string) {
    if (!requestedEmail || typeof requestedEmail !== 'string') throw new BadRequestException('Student email is required.');
    if (email !== requestedEmail.trim().toLowerCase()) throw new ForbiddenException('You can analyze only the resume saved in your own profile.');
    const profile = await this.prisma.student_profiles.findUnique({ where: { email } });
    if (!profile?.resume_data_url) throw new NotFoundException('No resume is saved in this profile.');
    const encoded = profile.resume_data_url.includes(',') ? profile.resume_data_url.split(',', 2)[1] : profile.resume_data_url;
    return this.analyze(email, profile.resume_file_name || 'profile-resume.pdf', Buffer.from(encoded, 'base64'));
  }
}
