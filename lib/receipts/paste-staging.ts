// S-26: a plain client-side module singleton, not a React context/store --
// bridges a paste event that can happen on ANY page to app/add/capture.tsx,
// which may or may not be mounted yet when the paste occurs. If a subscriber
// (AddCapture, already on /add) is registered, it's notified directly; if
// not, the file is held until the next subscribe() call (AddCapture mounting
// right after the paste listener's router.push('/add')).

let pendingFile: File | null = null;
let listener: ((file: File) => void) | null = null;

export function stageFile(file: File): void {
  if (listener) {
    listener(file);
  } else {
    pendingFile = file;
  }
}

export function subscribeStagedFile(cb: (file: File) => void): () => void {
  listener = cb;
  if (pendingFile) {
    const file = pendingFile;
    pendingFile = null;
    cb(file);
  }
  return () => {
    if (listener === cb) listener = null;
  };
}
