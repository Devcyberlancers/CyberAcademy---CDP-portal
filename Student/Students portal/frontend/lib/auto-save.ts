const queueKey = "secure-assessment-pending-answers";

type QueuedAnswer = {
  attemptId: number;
  questionId: string;
  optionId: string;
  apiBaseUrl: string;
  createdAt: string;
};

function readQueue(): QueuedAnswer[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(queueKey) || "[]") as QueuedAnswer[];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedAnswer[]) {
  window.localStorage.setItem(queueKey, JSON.stringify(items));
}

export async function saveAnswer(apiBaseUrl: string, attemptId: number, questionId: string, optionId: string) {
  const payload = { question_id: questionId, option_id: optionId, client_timestamp: new Date().toISOString() };
  try {
    const response = await fetch(`${apiBaseUrl}/api/assignments/${attemptId}/save-answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Save failed ${response.status}`);
  } catch {
    writeQueue([...readQueue(), { attemptId, questionId, optionId, apiBaseUrl, createdAt: new Date().toISOString() }]);
  }
}

export async function syncQueuedAnswers() {
  const queued = readQueue();
  if (queued.length === 0 || !navigator.onLine) return;
  const remaining: QueuedAnswer[] = [];
  for (const item of queued) {
    try {
      await saveAnswer(item.apiBaseUrl, item.attemptId, item.questionId, item.optionId);
    } catch {
      remaining.push(item);
    }
  }
  writeQueue(remaining);
}
