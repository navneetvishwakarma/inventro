'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { extensionForMimeType } from '@/lib/receipts/formats';
import { stageFile } from '@/lib/receipts/paste-staging';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

// S-26: global Cmd/Ctrl+V image capture. Mounted as a client child of the
// server component app/layout.tsx — the layout itself stays a server
// component. Never intercepts a paste focused inside an input/textarea/
// contenteditable (S-28's own paste-text textarea included), and never
// touches clipboard content that isn't an image (an ordinary text paste
// anywhere in the app is left completely alone).
export function PasteListener() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (isEditableTarget(e.target)) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
      if (!imageItem) return;

      const blob = imageItem.getAsFile();
      if (!blob) return;

      e.preventDefault();

      const ext = extensionForMimeType(imageItem.type) ?? 'jpg';
      const file = new File([blob], `pasted-${Date.now()}.${ext}`, { type: imageItem.type });

      stageFile(file);
      if (pathname !== '/add') router.push('/add');
    }

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [pathname, router]);

  return null;
}
