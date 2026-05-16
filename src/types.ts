export type CaseType = 'Personal Injury' | 'Divorce / Asset Division' | 'Employment Litigation' | 'Insurance Fraud';
export type DocumentType = 'Receipt' | 'Medical Bill' | 'Bank Statement' | 'Invoice' | 'Handwritten Note';
export type ExtractionStatus = 'queued' | 'extracting' | 'complete' | 'review';

export interface LegalCase {
  id: string;
  title: string;
  caseType: CaseType;
  clientName: string;
  attorneyName: string;
  createdAt: string;
}

export interface EvidenceDocument {
  id: string;
  caseId: string;
  originalFilename: string;
  documentType: DocumentType;
  veryfiId: string;
  extractionStatus: ExtractionStatus;
  confidenceScore: number;
  isFlagged: boolean;
  flagReason?: string;
  uploadedAt: string;
  thumbnailTone: string;
}

export interface Transaction {
  id: string;
  documentId: string;
  caseId: string;
  date: string;
  vendorName: string;
  category: string;
  amount: number;
  currency: 'USD';
  description: string;
  lineItems: Array<{ item: string; amount: number }>;
  isDuplicate: boolean;
  tamperingDetected: boolean;
}

export interface UploadItem {
  id: string;
  filename: string;
  type: DocumentType;
  progress: number;
  status: ExtractionStatus;
  confidence?: number;
  error?: string;
}
