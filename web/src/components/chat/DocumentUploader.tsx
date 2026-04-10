import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { FileUp, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { GET_DOCUMENT_LIFECYCLE, UPLOAD_DOCUMENT } from '../../graphql/chats';

interface UploadDocumentResponse {
  uploadDocument: {
    success: boolean;
    message: string;
  };
}

interface DocumentLifecycleData {
  me: {
    id: string;
    documents: Array<{
      id: string;
      status: string;
      updatedAt: string;
    }>;
  };
}

interface DocumentUploaderProps {
  disabled?: boolean;
  onStatus?: (type: 'success' | 'error', message: string) => void;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default function DocumentUploader({ disabled = false, onStatus }: DocumentUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localStatus, setLocalStatus] = useState<'processing' | 'ready' | 'failed' | null>(null);

  const [uploadDocument, { loading }] = useMutation<UploadDocumentResponse>(UPLOAD_DOCUMENT);
  const { data: lifecycleData, startPolling, stopPolling } = useQuery<DocumentLifecycleData>(GET_DOCUMENT_LIFECYCLE, {
    fetchPolicy: 'cache-and-network',
  });

  const latestDocument = lifecycleData?.me?.documents?.[0];
  const latestStatus = (latestDocument?.status || '').toLowerCase();
  const effectiveStatus = localStatus ?? (latestStatus === 'processing' || latestStatus === 'ready' || latestStatus === 'failed'
    ? (latestStatus as 'processing' | 'ready' | 'failed')
    : null);

  useEffect(() => {
    if (latestStatus === 'ready' || latestStatus === 'failed') {
      setLocalStatus(null);
    }
  }, [latestStatus]);

  useEffect(() => {
    const isProcessing = localStatus === 'processing' || latestStatus === 'processing';

    if (isProcessing) {
      startPolling(8000);
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [latestStatus, localStatus, startPolling, stopPolling]);

  const handleFilePicked = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      onStatus?.('error', 'Only PDF, TXT, MD, DOC, and DOCX files are supported.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      onStatus?.('error', 'Document must be 15MB or smaller.');
      return;
    }

    setSelectedFile(file);
    setLocalStatus('processing');

    try {
      const { data } = await uploadDocument({ variables: { file } });
      const result = data?.uploadDocument;

      if (result?.success) {
        onStatus?.('success', result.message || `${file.name} uploaded. Processing started.`);
      } else {
        setLocalStatus('failed');
        onStatus?.('error', result?.message || 'Upload failed.');
      }
    } catch (error: unknown) {
      setLocalStatus('failed');
      const message = error instanceof Error ? error.message : 'Upload failed.';
      onStatus?.('error', message);
    }
  };

  const statusBadge = (() => {
    if (!effectiveStatus) return null;

    if (effectiveStatus === 'processing') {
      return {
        label: 'Knowledge processing...',
        className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      };
    }

    if (effectiveStatus === 'ready') {
      return {
        label: 'Knowledge ready for retrieval',
        className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      };
    }

    return {
      label: 'Knowledge processing failed',
      className: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    };
  })();

  return (
    <div className="rounded-xl border border-theme-light bg-theme-secondary/70 p-3">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.txt,.md,.doc,.docx"
        disabled={disabled || loading}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) {
            await handleFilePicked(file);
          }
          event.currentTarget.value = '';
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || loading}
        className="w-full flex items-center justify-between gap-3 rounded-lg border border-theme-light bg-theme-input px-3 py-2 text-left hover:bg-theme-tertiary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2 min-w-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
          ) : (
            <FileUp className="h-4 w-4 text-indigo-400" />
          )}
          <span className="text-sm text-theme-primary truncate">
            {loading ? 'Uploading document...' : selectedFile ? selectedFile.name : 'Add knowledge document'}
          </span>
        </div>

        {loading ? (
          <span className="text-xs text-theme-tertiary">Processing</span>
        ) : selectedFile ? (
          <CheckCircle2 className="h-4 w-4 text-green-400" />
        ) : (
          <AlertCircle className="h-4 w-4 text-theme-tertiary" />
        )}
      </button>

      {statusBadge && (
        <div className={`mt-2 inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${statusBadge.className}`}>
          {statusBadge.label}
        </div>
      )}
    </div>
  );
}
