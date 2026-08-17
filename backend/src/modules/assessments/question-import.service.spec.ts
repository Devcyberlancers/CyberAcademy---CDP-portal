import { QuestionImportService } from './question-import.service';

describe('QuestionImportService', () => {
  const service = new QuestionImportService();

  it('parses MCQ and descriptive questions and resolves answer letters', () => {
    const result = service.parseText([
      'Q1. Which protocol secures web traffic?',
      'A. HTTP',
      'B. HTTPS',
      'Answer: B',
      'Marks: 2',
      'Explanation: TLS protects the connection.',
      'Question 2: Explain least privilege.',
      'Answer: Give users only the access required for their role.',
      'Marks: 5',
    ].join('\n'));

    expect(result.questionCount).toBe(2);
    expect(result.questions[0]).toMatchObject({ answer: 'HTTPS', marks: 2, type: 'MCQ', needsReview: false });
    expect(result.questions[1]).toMatchObject({ marks: 5, type: 'Descriptive', needsReview: false });
  });

  it('marks an unanswered imported question for review', () => {
    const result = service.parseText('1. What is phishing?\nA. A social engineering attack\nB. A firewall');
    expect(result.questions[0].needsReview).toBe(true);
    expect(result.warnings).toContain('Question 1 has no recognized answer.');
  });
});
