export type ProctoringStreamWindow = Window & {
  __cyberAcademyScreenStream?: MediaStream;
  __cyberAcademyMediaStream?: MediaStream;
};

export function proctoringStreams() {
  const owner = window as ProctoringStreamWindow;
  return { camera: owner.__cyberAcademyMediaStream, screen: owner.__cyberAcademyScreenStream };
}

export function stopProctoringStreams() {
  const owner = window as ProctoringStreamWindow;
  owner.__cyberAcademyMediaStream?.getTracks().forEach((track) => track.stop());
  owner.__cyberAcademyScreenStream?.getTracks().forEach((track) => track.stop());
  delete owner.__cyberAcademyMediaStream;
  delete owner.__cyberAcademyScreenStream;
}

export function activeTrack(stream: MediaStream | undefined, kind: "audio" | "video") {
  const tracks = kind === "audio" ? stream?.getAudioTracks() : stream?.getVideoTracks();
  return Boolean(tracks?.some((track) => track.readyState === "live" && track.enabled));
}
