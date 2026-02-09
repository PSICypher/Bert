'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { usePWA } from '@/hooks/usePWA';

export function InstallBanner() {
  const { canInstall, install } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-purple-600 text-white p-4 rounded-lg shadow-lg flex items-center justify-between z-50">
      <div className="flex-1">
        <p className="font-medium">Install Holiday Planner</p>
        <p className="text-sm opacity-90">Add to your home screen for quick access</p>
      </div>
      <div className="flex items-center gap-2 ml-4">
        <button
          onClick={install}
          className="bg-white text-purple-600 px-4 py-2 rounded-lg font-medium hover:bg-purple-50 transition-colors"
        >
          Install
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-2 hover:bg-purple-700 rounded-lg transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
