'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload,
  File,
  FileText,
  Image,
  Trash2,
  Download,
  X,
  FolderOpen,
} from 'lucide-react';
import type { Database } from '@/lib/database.types';

type Document = Database['public']['Tables']['documents']['Row'];

interface DocumentsTabProps {
  tripId: string;
}

const FILE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'application/pdf': FileText,
  'image/jpeg': Image,
  'image/png': Image,
  'image/webp': Image,
  default: File,
};

const FILE_TYPE_GROUPS: Record<string, string[]> = {
  Images: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  Documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  Other: [],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function DocumentsTab({ tripId }: DocumentsTabProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents?trip_id=${tripId}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const getFileGroup = (fileType: string | null): string => {
    if (!fileType) return 'Other';
    for (const [group, types] of Object.entries(FILE_TYPE_GROUPS)) {
      if (group === 'Other') continue;
      if (types.includes(fileType)) return group;
    }
    return 'Other';
  };

  const groupedDocuments = documents.reduce((acc, doc) => {
    const group = getFileGroup(doc.file_type);
    if (!acc[group]) acc[group] = [];
    acc[group].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          setError(`${file.name} exceeds 10MB limit`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('trip_id', tripId);

        const res = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || `Failed to upload ${file.name}`);
        }
      }

      await loadDocuments();
    } catch (err) {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents?id=${docId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  const getIcon = (fileType: string | null) => {
    const Icon = FILE_TYPE_ICONS[fileType || 'default'] || FILE_TYPE_ICONS.default;
    return Icon;
  };

  const isImage = (fileType: string | null) => {
    return fileType?.startsWith('image/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
        />

        <Upload
          className={`w-10 h-10 mx-auto mb-3 ${
            dragActive ? 'text-blue-500' : 'text-gray-400'
          }`}
        />
        <p className="text-sm text-gray-600 mb-2">
          {uploading ? 'Uploading...' : 'Drag and drop files here, or'}
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
        >
          browse files
        </button>
        <p className="text-xs text-gray-500 mt-2">
          PDF, JPG, PNG, WEBP, DOC (max 10MB each)
        </p>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedDocuments).map(([group, docs]) => (
            <div key={group}>
              <h3 className="text-sm font-medium text-gray-700 mb-3">{group}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {docs.map((doc) => {
                  const Icon = getIcon(doc.file_type);

                  return (
                    <div
                      key={doc.id}
                      className="group relative border rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow"
                    >
                      {isImage(doc.file_type) ? (
                        <div className="aspect-square bg-gray-100">
                          <img
                            src={doc.file_url}
                            alt={doc.file_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-square bg-gray-50 flex items-center justify-center">
                          <Icon className="w-12 h-12 text-gray-400" />
                        </div>
                      )}

                      <div className="p-2">
                        <p className="text-xs text-gray-700 truncate" title={doc.file_name}>
                          {doc.file_name}
                        </p>
                      </div>

                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="p-1.5 bg-white rounded-full shadow hover:bg-gray-50 transition-colors"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5 text-gray-600" />
                        </a>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 bg-white rounded-full shadow hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
