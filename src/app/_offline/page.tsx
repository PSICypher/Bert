'use client';

import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 max-w-md">
        <div className="w-16 h-16 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-6">
          <WifiOff className="w-8 h-8 text-purple-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          You&apos;re Offline
        </h1>
        <p className="text-gray-600 mb-6">
          Check your internet connection and try again.
          Your data will sync when you&apos;re back online.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
