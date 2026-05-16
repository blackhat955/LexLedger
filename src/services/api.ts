import type { EvidenceDocument, Transaction } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

export interface ExtractionResult {
  mode: 'live' | 'mock';
  document: EvidenceDocument;
  transactions: Transaction[];
  classification: unknown;
  extraction: unknown;
}

export async function uploadEvidenceDocument(caseId: string, file: File): Promise<ExtractionResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/cases/${caseId}/documents`, {
    method: 'POST',
    body: formData,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body?.error || `Upload failed with status ${response.status}`);
  }

  return body;
}
