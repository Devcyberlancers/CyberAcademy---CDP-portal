export function remainingSeconds(endsAt: string) {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
}

export function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
