'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BookOpenCheck, ClipboardCheck, Download, FileSpreadsheet, Trophy, Upload, X } from 'lucide-react';
import {
  downloadWrittenExamTemplate,
  getAdminBatchLeaderboard,
  getAdminCourseLeaderboard,
  type BatchLeaderboard,
  type CourseLeaderboard,
  type LeaderboardAttempt,
  type LeaderboardStudent,
  uploadWrittenExamResults,
} from '@/lib/admin-api';

type Board = CourseLeaderboard | BatchLeaderboard;

export function AdminLeaderboardDialog({ courseId, courseTitle, onClose }: { courseId?: string; courseTitle?: string; onClose: () => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setBoard(courseId ? await getAdminCourseLeaderboard(courseId) : await getAdminBatchLeaderboard());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Leaderboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function importResults(file?: File) {
    if (!file) return;
    setLoading(true);
    setImportResult('');
    try {
      const result = await uploadWrittenExamResults(file);
      setImportResult(`${result.imported} result(s) imported.${result.rejected ? ` ${result.rejected} row(s) rejected.` : ''}`);
      if (result.errors.length) setError(result.errors.slice(0, 6).map((item) => `Row ${item.row}: ${item.message}`).join(' | '));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Results import failed.');
      setLoading(false);
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4' role='dialog' aria-modal='true' aria-label='Leaderboard'>
      <div className='max-h-[94vh] w-full max-w-7xl overflow-y-auto rounded-2xl bg-white shadow-2xl'>
        <header className='sticky top-0 z-10 flex flex-wrap items-start justify-between gap-4 border-b border-portal-line bg-white p-5'>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.18em] text-portal-blue'>{courseId ? 'Course leaderboard' : 'Batch leaderboard'}</p>
            <h2 className='mt-1 text-2xl font-black text-slate-950'>{courseTitle || board?.batch || 'Selected batch'}</h2>
            <p className='mt-1 text-sm text-slate-500'>Best score per test is ranked; unattempted tests remain zero.</p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <button type='button' onClick={() => void downloadWrittenExamTemplate()} className='inline-flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold text-slate-700'><Download size={16} /> CSV Template</button>
            <label className='inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-portal-blue px-4 text-sm font-bold text-white'>
              <Upload size={16} /> Import CSV / XLSX
              <input type='file' accept='.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' className='sr-only' onChange={(event) => { void importResults(event.target.files?.[0]); event.currentTarget.value = ''; }} />
            </label>
            <button type='button' onClick={onClose} className='grid h-10 w-10 place-items-center rounded-full border border-portal-line' aria-label='Close leaderboard'><X size={19} /></button>
          </div>
        </header>

        <div className='p-5'>
          {importResult ? <p className='mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800'>{importResult}</p> : null}
          {error ? <p className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700'>{error}</p> : null}
          {loading ? <p className='py-16 text-center font-semibold text-slate-500'>Loading live leaderboard...</p> : null}
          {!loading && board ? (
            <>
              <div className='mb-5 grid gap-4 md:grid-cols-3'>
                <SummaryCard label='Current topper' value={board.topper?.student_name || 'No scored attempts yet'} note={board.topper ? `${board.topper.registration_number} / ${board.topper.score}%` : 'Results update automatically after submissions and imports.'} topper />
                <SummaryCard label='Students ranked' value={String(board.students.length)} />
                <SummaryCard label='Scored components' value={String(board.scope === 'course' ? board.components.total : board.components.courses + board.components.assessments + board.components.written_exams)} />
              </div>
              <div className='overflow-x-auto rounded-xl border border-portal-line'>
                <table className='w-full min-w-[760px] text-left text-sm'>
                  <thead className='bg-slate-100 text-slate-600'><tr><th className='p-4'>Rank</th><th className='p-4'>Student</th><th className='p-4'>Overall</th><th className='p-4'>Completion</th><th className='p-4'>Attempts</th><th className='p-4'>Results</th></tr></thead>
                  <tbody>
                    {board.students.map((student) => (
                      <tr key={student.student_id} className='border-t border-portal-line align-top'>
                        <td className='p-4 text-lg font-black text-portal-blue'>#{student.rank}</td>
                        <td className='p-4'><strong className='block text-slate-950'>{student.student_name}</strong><span className='text-xs text-slate-500'>{student.registration_number} / {student.student_email}</span></td>
                        <td className='p-4 font-black text-slate-950'>{student.score}%</td>
                        <td className='p-4'><span className='font-semibold'>{student.completion_percent}%</span><div className='mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-200'><div className='h-full rounded-full bg-portal-blue' style={{ width: `${Math.min(100, student.completion_percent)}%` }} /></div></td>
                        <td className='p-4'>{student.attempts}</td>
                        <td className='p-4'><StudentBreakdown student={student} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, note, topper = false }: { label: string; value: string; note?: string; topper?: boolean }) {
  return <div className={`rounded-xl border p-5 ${topper ? 'border-amber-200 bg-amber-50' : 'border-portal-line bg-slate-50'}`}><span className={`flex items-center gap-2 text-sm font-bold ${topper ? 'text-amber-800' : 'text-slate-500'}`}>{topper ? <Trophy size={18} /> : null}{label}</span><strong className={`mt-3 block text-slate-950 ${topper ? 'text-xl' : 'text-3xl'}`}>{value}</strong>{note ? <span className='mt-1 block text-sm text-slate-600'>{note}</span> : null}</div>;
}

function StudentBreakdown({ student }: { student: LeaderboardStudent }) {
  const attempts = student.attempt_results ?? [];
  const written = attempts.filter((item) => item.source === 'written_exam');
  const courseAttempts = attempts.filter((item) => item.source === 'course_test');
  const assessments = attempts.filter((item) => item.source === 'assessment');
  const courseScores = student.course_scores ?? [];
  return (
    <details>
      <summary className='cursor-pointer select-none font-bold text-portal-blue'>View breakdown</summary>
      <div className='mt-4 grid min-w-[720px] gap-4 lg:grid-cols-3'>
        <BreakdownSection title='Written Tests' icon={FileSpreadsheet} count={written.length}>{written.map((attempt, index) => <AttemptResult key={resultKey(attempt, index)} attempt={attempt} />)}</BreakdownSection>
        <BreakdownSection title='Course-wise Assessments' icon={BookOpenCheck} count={courseScores.length + courseAttempts.length}>
          {courseScores.map((course) => <div key={course.course_id} className='rounded-lg border border-slate-200 bg-white p-3'><strong className='block text-sm text-slate-900'>{course.course_title}</strong><p className='mt-1 text-xs leading-5 text-slate-600'>Rank {course.rank ? '#' + course.rank : 'Not ranked'} / Score {course.score}% / {course.attempts} attempt(s)</p></div>)}
          {courseAttempts.map((attempt, index) => <AttemptResult key={resultKey(attempt, index)} attempt={attempt} />)}
        </BreakdownSection>
        <BreakdownSection title='Assessments' icon={ClipboardCheck} count={assessments.length}>{assessments.map((attempt, index) => <AttemptResult key={resultKey(attempt, index)} attempt={attempt} />)}</BreakdownSection>
      </div>
    </details>
  );
}

function BreakdownSection({ title, icon: Icon, count, children }: { title: string; icon: typeof Trophy; count: number; children: ReactNode }) {
  return <section className='rounded-xl border border-slate-200 bg-slate-50 p-3'><header className='mb-3 flex items-center justify-between gap-3'><span className='flex items-center gap-2 font-bold text-slate-900'><Icon size={17} className='text-portal-blue' />{title}</span><span className='rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600'>{count}</span></header><div className='max-h-64 space-y-2 overflow-y-auto pr-1'>{count ? children : <p className='rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500'>No results recorded yet.</p>}</div></section>;
}

function AttemptResult({ attempt }: { attempt: LeaderboardAttempt }) {
  return <div className='rounded-lg border border-slate-200 bg-white p-3'><strong className='block text-sm text-slate-900'>{attempt.assessment_title}</strong><p className='mt-1 text-xs leading-5 text-slate-600'>Attempt {attempt.attempt_number} / {attempt.earned_marks}/{attempt.max_marks} / {attempt.score}% / {attempt.status.replaceAll('_', ' ')}</p></div>;
}

function resultKey(attempt: LeaderboardAttempt, index: number) {
  return attempt.source + '-' + attempt.assessment_id + '-' + attempt.attempt_number + '-' + index;
}
