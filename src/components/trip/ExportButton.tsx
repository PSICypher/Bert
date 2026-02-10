'use client';

import { useState } from 'react';
import { Download, Link2, Copy, Check, X, ChevronDown } from 'lucide-react';

interface ExportButtonProps {
  tripId: string;
  tripName: string;
}

export function ExportButton({ tripId, tripName }: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingShare, setLoadingShare] = useState(false);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/export`);
      if (res.ok) {
        const html = await res.text();
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => printWindow.print(), 500);
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
      setShowMenu(false);
    }
  };

  const handleGenerateLink = async () => {
    setLoadingShare(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/public-token`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        const url = `${window.location.origin}/share/${data.token}`;
        setShareUrl(url);
      }
    } catch (err) {
      console.error('Failed to generate link:', err);
    } finally {
      setLoadingShare(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRevokeLink = async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/public-token`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setShareUrl(null);
      }
    } catch (err) {
      console.error('Failed to revoke link:', err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border rounded-lg shadow-lg w-72 overflow-hidden">
            <div className="p-2">
              <button
                onClick={handleExportPdf}
                disabled={exporting}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900">
                    {exporting ? 'Preparing...' : 'Export as PDF'}
                  </p>
                  <p className="text-xs text-gray-500">Print-ready document</p>
                </div>
              </button>
            </div>

            <div className="border-t p-3">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">Public Share Link</span>
              </div>

              {shareUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 text-xs bg-gray-50 border rounded px-2 py-1.5 truncate"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
                      title="Copy link"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <button
                    onClick={handleRevokeLink}
                    className="text-xs text-red-600 hover:text-red-700 transition-colors"
                  >
                    Revoke link
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateLink}
                  disabled={loadingShare}
                  className="w-full text-sm text-blue-600 hover:text-blue-700 py-1.5 disabled:opacity-50 transition-colors"
                >
                  {loadingShare ? 'Generating...' : 'Generate shareable link'}
                </button>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Anyone with the link can view this trip
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
