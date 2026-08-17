'use client';

import { Trophy } from 'lucide-react';

export type StudentLeaderboardAttempt = {
  source: 'course_test' | 'assessment' | 'written_exam'; assessment_id: string; assessment_title: string;
  attempt_number: number; score: number; earned_marks: number; max_marks: number; status: string; attempted_at?: string | null;
};
export type StudentLeaderboardRow = {
  rank: number; student_id: number; student_name: string; registration_number: string; score: number;
  completion_percent: number; attempts: number; online_score?: number | null; written_score?: number | null;
  written_exam_score?: number | null; is_current_student?: boolean; attempt_results?: StudentLeaderboardAttempt[];
  course_scores?: Array<{ course_id: number; course_title: string; rank?: number | null; score: number; completion_percent: number; attempts: number }>;
};
export type StudentLeaderboardData = {
  scope: 'course' | 'batch'; batch: string; generated_at: string;
  course?: { id: number; title: string };
  topper: { student_name: string; registration_number: string; score: number } | null;
  students: StudentLeaderboardRow[];
};

export async function fetchStudentLeaderboard(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';
  const token = window.localStorage.getItem('cyber-academy-auth-token');
  const response = await fetch(base + path, {
    cache: 'no-store',
    headers: token ? { Authorization: 'Bearer ' + token } : {},
  });
  if (!response.ok) throw new Error('Leaderboard could not be loaded.');
  return response.json() as Promise<StudentLeaderboardData>;
}

export function StudentLeaderboard({ board, title }: { board: StudentLeaderboardData; title?: string }) {
  return (
    <section className='mt-7 overflow-hidden rounded-2xl border border-[#dfe4f2] bg-white shadow-sm'>
      <header className='flex flex-wrap items-center justify-between gap-4 border-b border-[#e4e7ee] bg-[#f7f8ff] px-5 py-4'>
        <div>
          <p className='text-xs font-bold uppercase tracking-[0.16em] text-[#3155ff]'>{board.scope === 'course' ? 'Course leaderboard' : 'Batch leaderboard'}</p>
          <h2 className='mt-1 text-xl font-bold text-[#07142f]'>{title || board.course?.title || board.batch}</h2>
        </div>
        <div className='flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3'>
          <Trophy size={20} className='text-amber-600' />
          <span><small className='block font-semibold text-amber-800'>Top performer</small><strong className='text-[#07142f]'>{board.topper?.student_name || 'Awaiting results'}</strong></span>
          {board.topper ? <b className='text-amber-700'>{board.topper.score}%</b> : null}
        </div>
      </header>
      <div className='overflow-x-auto p-4 sm:p-5'>
        <table className='w-full min-w-[820px] text-left text-sm'>
          <thead className='bg-[#e8ebff] text-[#44506b]'>
            <tr><th className='p-3'>Rank</th><th className='p-3'>Student</th><th className='p-3'>Overall Score</th><th className='p-3'>Completion</th><th className='p-3'>Attempts</th><th className='p-3'>Results</th></tr>
          </thead>
          <tbody>
            {board.students.map((student) => (
              <tr key={student.student_id} className={'border-b border-[#edf0f5] align-top ' + (student.is_current_student ? 'bg-blue-50/70' : '')}>
                <td className='p-3 text-lg font-black text-[#3155ff]'>#{student.rank}</td>
                <td className='p-3'><strong className='block text-[#07142f]'>{student.student_name}{student.is_current_student ? ' (You)' : ''}</strong><span className='text-xs text-[#68738a]'>{student.registration_number}</span></td>
                <td className='p-3 font-black text-[#07142f]'>{student.score}%</td>
                <td className='p-3'>{student.completion_percent}%</td>
                <td className='p-3'>{student.attempts}</td>
                <td className='p-3'>
                  <details>
                    <summary className='cursor-pointer font-bold text-[#3155ff]'>View scores</summary>
                    <div className='mt-2 min-w-[330px] space-y-2'>
                      {student.attempt_results?.map((attempt, index) => (
                        <div key={attempt.assessment_id + '-' + attempt.attempt_number + '-' + index} className='rounded-md bg-[#f7f8fc] p-2.5'>
                          <strong>{attempt.assessment_title}</strong>
                          <p className='mt-1 text-xs text-[#68738a]'>Attempt {attempt.attempt_number} · {attempt.earned_marks}/{attempt.max_marks} · {attempt.score}%</p>
                        </div>
                      ))}
                      {student.course_scores?.map((course) => (
                        <div key={course.course_id} className='rounded-md bg-[#f7f8fc] p-2.5'>
                          <strong>{course.course_title}</strong>
                          <p className='mt-1 text-xs text-[#68738a]'>Course rank {course.rank ? '#' + course.rank : '—'} · {course.score}% · {course.attempts} attempts</p>
                        </div>
                      ))}
                      {!student.attempt_results?.length && !student.course_scores?.length ? <p className='text-xs text-[#68738a]'>No completed results yet.</p> : null}
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!board.students.length ? <p className='py-10 text-center text-[#68738a]'>No students are available in this batch.</p> : null}
      </div>
    </section>
  );
}
