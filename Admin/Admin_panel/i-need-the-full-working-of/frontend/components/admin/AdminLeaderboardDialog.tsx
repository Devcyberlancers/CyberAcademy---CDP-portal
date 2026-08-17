'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Trophy, Upload, X } from 'lucide-react';
import {
  downloadWrittenExamTemplate, getAdminBatchLeaderboard, getAdminCourseLeaderboard,
  type BatchLeaderboard, type CourseLeaderboard, uploadWrittenExamResults,
} from '@/lib/admin-api';

type Board = CourseLeaderboard | BatchLeaderboard;

export function AdminLeaderboardDialog({
  courseId,
  courseTitle,
  onClose,
}: {
  courseId?: string;
  courseTitle?: string;
  onClose: () => void;
}) {
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

  async function importCsv(file?: File) {
    if (!file) return;
    setLoading(true);
    setImportResult('');
    try {
      const result = await uploadWrittenExamResults(file);
      const rejected = result.rejected ? ' ' + result.rejected + ' row(s) rejected.' : '';
      setImportResult(result.imported + ' result(s) imported.' + rejected);
      if (result.errors.length) setError(result.errors.slice(0, 6).map((item) => 'Row ' + item.row + ': ' + item.message).join(' | '));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'CSV import failed.');
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
            <button type='button' onClick={() => void downloadWrittenExamTemplate()} className='inline-flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold text-slate-700'>
              <Download size={16} /> CSV Template
            </button>
            <label className='inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-portal-blue px-4 text-sm font-bold text-white'>
              <Upload size={16} /> Import Written Results
              <input type='file' accept='.csv,text/csv' className='sr-only' onChange={(event) => { void importCsv(event.target.files?.[0]); event.currentTarget.value = ''; }} />
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
                <div className='rounded-xl border border-amber-200 bg-amber-50 p-5'>
                  <span className='flex items-center gap-2 text-sm font-bold text-amber-800'><Trophy size={18} /> Current topper</span>
                  <strong className='mt-3 block text-xl text-slate-950'>{board.topper?.student_name || 'No scored attempts yet'}</strong>
                  <span className='mt-1 block text-sm text-slate-600'>{board.topper ? board.topper.registration_number + ' · ' + board.topper.score + '%' : 'Results update automatically after submissions and imports.'}</span>
                </div>
                <div className='rounded-xl border border-portal-line bg-slate-50 p-5'>
                  <span className='text-sm font-bold text-slate-500'>Students ranked</span>
                  <strong className='mt-3 block text-3xl text-slate-950'>{board.students.length}</strong>
                </div>
                <div className='rounded-xl border border-portal-line bg-slate-50 p-5'>
                  <span className='text-sm font-bold text-slate-500'>Scored components</span>
                  <strong className='mt-3 block text-3xl text-slate-950'>{board.scope === 'course' ? board.components.total : board.components.courses + board.components.written_exams}</strong>
                </div>
              </div>
              <div className='overflow-x-auto rounded-xl border border-portal-line'>
                <table className='w-full min-w-[980px] text-left text-sm'>
                  <thead className='bg-slate-100 text-slate-600'>
                    <tr><th className='p-3'>Rank</th><th className='p-3'>Student</th><th className='p-3'>Overall</th><th className='p-3'>Completion</th><th className='p-3'>Attempts</th><th className='p-3'>Online</th><th className='p-3'>Written</th><th className='p-3'>Results</th></tr>
                  </thead>
                  <tbody>
                    {board.students.map((student) => (
                      <tr key={student.student_id} className='border-t border-portal-line align-top'>
                        <td className='p-3 text-lg font-black text-portal-blue'>#{student.rank}</td>
                        <td className='p-3'><strong className='block text-slate-950'>{student.student_name}</strong><span className='text-xs text-slate-500'>{student.registration_number} · {student.student_email}</span></td>
                        <td className='p-3 font-black text-slate-950'>{student.score}%</td>
                        <td className='p-3'>{student.completion_percent}%</td>
                        <td className='p-3'>{student.attempts}</td>
                        <td className='p-3'>{student.online_score == null ? '—' : student.online_score + '%'}</td>
                        <td className='p-3'>{(student.written_score ?? student.written_exam_score) == null ? '—' : (student.written_score ?? student.written_exam_score) + '%'}</td>
                        <td className='p-3'>
                          <details>
                            <summary className='cursor-pointer font-bold text-portal-blue'>View breakdown</summary>
                            <div className='mt-3 min-w-[360px] space-y-2'>
                              {student.attempt_results?.map((attempt, index) => (
                                <div key={attempt.assessment_id + '-' + attempt.attempt_number + '-' + index} className='rounded-md bg-slate-50 p-3'>
                                  <strong>{attempt.assessment_title}</strong><span className='ml-2 text-xs uppercase text-slate-500'>{attempt.source.replace('_', ' ')}</span>
                                  <p className='mt-1 text-xs text-slate-600'>Attempt {attempt.attempt_number} · {attempt.earned_marks}/{attempt.max_marks} · {attempt.score}% · {attempt.status.replaceAll('_', ' ')}</p>
                                </div>
                              ))}
                              {student.course_scores?.map((course) => (
                                <div key={course.course_id} className='rounded-md bg-slate-50 p-3'><strong>{course.course_title}</strong><p className='mt-1 text-xs text-slate-600'>Rank {course.rank ? '#' + course.rank : '—'} · {course.score}% · {course.attempts} attempts</p></div>
                              ))}
                              {!student.attempt_results?.length && !student.course_scores?.length ? <p className='text-xs text-slate-500'>No results recorded yet.</p> : null}
                            </div>
                          </details>
                        </td>
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
