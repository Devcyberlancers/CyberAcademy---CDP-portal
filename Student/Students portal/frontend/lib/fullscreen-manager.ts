export async function enterFullscreen(element: HTMLElement = document.documentElement) {
  if (!document.fullscreenElement) {
    await element.requestFullscreen();
  }
}

export async function exitFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  }
}

export function isFullscreen() {
  return Boolean(document.fullscreenElement);
}
