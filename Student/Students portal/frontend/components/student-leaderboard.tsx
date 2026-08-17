'use client';

import { BookOpenCheck, ClipboardCheck, FileSpreadsheet, Trophy, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type StudentLeaderboardAttempt = {
  source: 'course_test' | 'assessment' | 'written_exam';
  assessment_id: string;
  assessment_title: string;
  attempt_number: number;
  score: number;
  earned_marks: number;
  max_marks: number;
  status: string;
  attempted_at?: string | null;
};
export type StudentLeaderboardRow = {
  rank: number;
  student_id: number;
  student_name: string;
  registration_number: string;
  score: number;
  completion_percent: number;
  attempts: number;
  online_score?: number | null;
  written_score?: number | null;
  written_exam_score?: number | null;
  is_current_student?: boolean;
  attempt_results?: StudentLeaderboardAttempt[];
  course_scores?: Array<{ course_id: number; course_title: string; rank?: number | null; score: number; completion_percent: number; attempts: number }>;
};
export type StudentLeaderboardData = {
  scope: 'course' | 'batch';
  batch: string;
  generated_at: string;
  course?: { id: number; title: string };
  topper: { student_name: string; registration_number: string; score: number } | null;
  students: StudentLeaderboardRow[];
};

export async function fetchStudentLeaderboard(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';
  const token = window.localStorage.getItem('cyber-academy-auth-token');
  const response = await fetch(base + path, { cache: 'no-store', headers: token ? { Authorization: 'Bearer ' + token } : {} });
  if (!response.ok) throw new Error('Leaderboard could not be loaded.');
  return response.json() as Promise<StudentLeaderboardData>;
}

export function StudentLeaderboard({ board, title }: { board: StudentLeaderboardData; title?: string }) {
  return (
    <section className='mt-7 overflow-hidden rounded-2xl border border-[#dfe4f2] bg-white shadow-sm'>
      <header className='flex flex-wrap items-center justify-between gap-5 border-b border-[#e4e7ee] bg-[#f7f8ff] px-5 py-5'>
        <div><p className='text-xs font-bold uppercase tracking-[0.16em] text-[#3155ff]'>{board.scope === 'course' ? 'Course leaderboard' : 'Batch leaderboard'}</p><h2 className='mt-1 text-xl font-bold text-[#07142f]'>{title || board.course?.title || board.batch}</h2></div>
        <div className='flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3'><Trophy size={20} className='text-amber-600' /><span><small className='block font-semibold text-amber-800'>Top performer</small><strong className='text-[#07142f]'>{board.topper?.student_name || 'Awaiting results'}</strong></span>{board.topper ? <b className='text-amber-700'>{board.topper.score}%</b> : null}</div>
      </header>
      <div className='overflow-x-auto p-4 sm:p-5'>
        <table className='w-full min-w-[720px] text-left text-sm'>
          <thead className='bg-[#e8ebff] text-[#44506b]'><tr><th className='p-4'>Rank</th><th className='p-4'>Student</th><th className='p-4'>Overall Score</th><th className='p-4'>Completion</th><th className='p-4'>Attempts</th><th className='p-4'>Results</th></tr></thead>
          <tbody>
            {board.students.map((student) => (
              <tr key={student.student_id} className={'border-b border-[#edf0f5] align-top ' + (student.is_current_student ? 'bg-blue-50/70' : '')}>
                <td className='p-4 text-lg font-black text-[#3155ff]'>#{student.rank}</td>
                <td className='p-4'><strong className='block text-[#07142f]'>{student.student_name}{student.is_current_student ? ' (You)' : ''}</strong><span className='text-xs text-[#68738a]'>{student.registration_number}</span></td>
                <td className='p-4 font-black text-[#07142f]'>{student.score}%</td>
                <td className='p-4'>{student.completion_percent}%</td>
                <td className='p-4'>{student.attempts}</td>
                <td className='p-4'><ScoreBreakdown student={student} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!board.students.length ? <p className='py-10 text-center text-[#68738a]'>No students are available in this batch.</p> : null}
      </div>
    </section>
  );
}

function ScoreBreakdown({ student }: { student: StudentLeaderboardRow }) {
  const attempts = student.attempt_results ?? [];
  const written = attempts.filter((item) => item.source === 'written_exam');
  const courseAttempts = attempts.filter((item) => item.source === 'course_test');
  const assessments = attempts.filter((item) => item.source === 'assessment');
  const courses = student.course_scores ?? [];
  return (
    <details>
      <summary className='cursor-pointer font-bold text-[#3155ff]'>View breakdown</summary>
      <div className='mt-3 grid min-w-[690px] gap-3 lg:grid-cols-3'>
        <BreakdownGroup title='Written Tests' icon={FileSpreadsheet} count={written.length}>{written.map((item, index) => <AttemptLine key={lineKey(item, index)} attempt={item} />)}</BreakdownGroup>
        <BreakdownGroup title='Course-wise Assessments' icon={BookOpenCheck} count={courses.length + courseAttempts.length}>
          {courses.map((course) => <div key={course.course_id} className='rounded-lg border border-[#e3e7ef] bg-white p-3'><strong className='block text-[#07142f]'>{course.course_title}</strong><p className='mt-1 text-xs leading-5 text-[#68738a]'>Course rank {course.rank ? '#' + course.rank : 'Not ranked'} / {course.score}% / {course.attempts} attempt(s)</p></div>)}
          {courseAttempts.map((item, index) => <AttemptLine key={lineKey(item, index)} attempt={item} />)}
        </BreakdownGroup>
        <BreakdownGroup title='Assessments' icon={ClipboardCheck} count={assessments.length}>{assessments.map((item, index) => <AttemptLine key={lineKey(item, index)} attempt={item} />)}</BreakdownGroup>
      </div>
    </details>
  );
}

function BreakdownGroup({ title, icon: Icon, count, children }: { title: string; icon: LucideIcon; count: number; children: ReactNode }) {
  return <section className='rounded-xl border border-[#e3e7ef] bg-[#f8f9fc] p-3'><header className='mb-3 flex items-center justify-between gap-2'><span className='flex items-center gap-2 font-bold text-[#07142f]'><Icon size={16} className='text-[#3155ff]' />{title}</span><span className='rounded-full bg-white px-2 py-1 text-xs font-bold'>{count}</span></header><div className='max-h-60 space-y-2 overflow-y-auto'>{count ? children : <p className='rounded-lg border border-dashed border-[#d7dce6] bg-white p-4 text-center text-xs text-[#68738a]'>No results recorded yet.</p>}</div></section>;
}

function AttemptLine({ attempt }: { attempt: StudentLeaderboardAttempt }) {
  return <div className='rounded-lg border border-[#e3e7ef] bg-white p-3'><strong className='block text-[#07142f]'>{attempt.assessment_title}</strong><p className='mt-1 text-xs leading-5 text-[#68738a]'>Attempt {attempt.attempt_number} / {attempt.earned_marks}/{attempt.max_marks} / {attempt.score}%</p></div>;
}

function lineKey(attempt: StudentLeaderboardAttempt, index: number) {
  return attempt.source + '-' + attempt.assessment_id + '-' + attempt.attempt_number + '-' + index;
}
