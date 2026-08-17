import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import path from 'node:path';

export type ImportedQuestion = {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  marks: number;
  section: string;
  type: 'MCQ' | 'Descriptive';
  needsReview: boolean;
};

type MutableQuestion = ImportedQuestion & { answerToken: string; mode: 'question' | 'option' | 'answer' | 'explanation' };

@Injectable()
export class QuestionImportService {
  async import(file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose a non-empty PDF, DOCX, TXT, or Markdown file.');
    const extension = path.extname(file.originalname || '').toLowerCase();
    let text = '';
    if (extension === '.pdf') {
      const parser = new PDFParse({ data: file.buffer });
      try { text = (await parser.getText()).text; } finally { await parser.destroy(); }
    } else if (extension === '.docx') {
      text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
    } else if (extension === '.txt' || extension === '.md') {
      text = file.buffer.toString('utf8');
    } else {
      throw new BadRequestException('Unsupported question file. Use PDF, DOCX, TXT, or Markdown. Convert legacy DOC files to DOCX first.');
    }
    const result = this.parseText(text);
    return { fileName: file.originalname, ...result };
  }

  parseText(source: string) {
    const lines = source.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
    const questions: MutableQuestion[] = [];
    let current: MutableQuestion | undefined;
    let currentOption = -1;

    const begin = (question: string) => {
      current = {
        question: question.trim(), options: [], answer: '', answerToken: '', explanation: '',
        marks: 1, section: '', type: 'Descriptive', needsReview: false, mode: 'question',
      };
      currentOption = -1;
      questions.push(current);
    };

    for (const line of lines) {
      const questionMatch = line.match(/^(?:q(?:uestion)?\s*)?(\d+)\s*[.):-]\s*(.+)$/i);
      const optionMatch = line.match(/^([A-H])\s*[.):-]\s*(.+)$/i);
      const answerMatch = line.match(/^(?:correct\s+answer|answer|ans)\s*[:=-]\s*(.+)$/i);
      const explanationMatch = line.match(/^(?:explanation|reason|solution)\s*[:=-]\s*(.*)$/i);
      const marksMatch = line.match(/^marks?\s*[:=-]\s*(\d+(?:\.\d+)?)$/i);
      const sectionMatch = line.match(/^section\s*[:=-]\s*(.+)$/i);

      if (questionMatch) {
        begin(questionMatch[2]);
      } else if (!current && /\?$/.test(line)) {
        begin(line);
      } else if (!current) {
        continue;
      } else if (optionMatch) {
        current.options.push(optionMatch[2].trim());
        currentOption = current.options.length - 1;
        current.mode = 'option';
      } else if (answerMatch) {
        current.answerToken = answerMatch[1].trim();
        current.mode = 'answer';
      } else if (explanationMatch) {
        current.explanation = explanationMatch[1].trim();
        current.mode = 'explanation';
      } else if (marksMatch) {
        current.marks = Math.max(0.25, Number(marksMatch[1]) || 1);
      } else if (sectionMatch) {
        current.section = sectionMatch[1].trim();
      } else if (current.mode === 'option' && currentOption >= 0) {
        current.options[currentOption] = (current.options[currentOption] + ' ' + line).trim();
      } else if (current.mode === 'explanation') {
        current.explanation = (current.explanation + ' ' + line).trim();
      } else if (current.mode === 'answer') {
        current.answerToken = (current.answerToken + ' ' + line).trim();
      } else {
        current.question = (current.question + ' ' + line).trim();
      }
    }

    if (!questions.length) {
      throw new UnprocessableEntityException('No questions were recognized. Start each question with Q1., Question 1:, or 1.');
    }

    const warnings: string[] = [];
    const normalized = questions.map((item, index): ImportedQuestion => {
      const letter = item.answerToken.match(/^([A-H])(?:\b|[.)])$/i)?.[1].toUpperCase();
      const answer = letter ? item.options[letter.charCodeAt(0) - 65] ?? item.answerToken : item.answerToken;
      const type = item.options.length >= 2 ? 'MCQ' as const : 'Descriptive' as const;
      const needsReview = !item.question || !answer || (type === 'MCQ' && item.options.length < 2);
      if (!answer) warnings.push('Question ' + (index + 1) + ' has no recognized answer.');
      if (type === 'MCQ' && !item.options.includes(answer)) warnings.push('Question ' + (index + 1) + ' answer does not exactly match an option.');
      return {
        question: item.question,
        options: item.options,
        answer,
        explanation: item.explanation,
        marks: item.marks,
        section: item.section,
        type,
        needsReview,
      };
    });
    return { questionCount: normalized.length, questions: normalized, warnings };
  }
}
