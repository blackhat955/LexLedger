const VERYFI_BASE_URL = 'https://api.veryfi.com/api/v8/partner';

const categories = ['Medical', 'Legal Fees', 'Transportation', 'Housing', 'Food', 'Insurance', 'Other'];

export function hasVeryfiCredentials() {
  return Boolean(
    process.env.VERYFI_CLIENT_ID &&
      process.env.VERYFI_CLIENT_SECRET &&
      process.env.VERYFI_USERNAME &&
      process.env.VERYFI_API_KEY,
  );
}

function veryfiHeaders() {
  return {
    'Content-Type': 'application/json',
    'CLIENT-ID': process.env.VERYFI_CLIENT_ID,
    AUTHORIZATION: `apikey ${process.env.VERYFI_USERNAME}:${process.env.VERYFI_API_KEY}`,
  };
}

async function postVeryfi(path, payload) {
  const response = await fetch(`${VERYFI_BASE_URL}${path}`, {
    method: 'POST',
    headers: veryfiHeaders(),
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body?.error || body?.message || `Veryfi request failed with ${response.status}`;
    throw new Error(message);
  }

  return body;
}

export async function classifyDocument(fileData) {
  return postVeryfi('/classify', { file_data: fileData });
}

export async function extractDocument({ fileData, documentType, caseId }) {
  const isBankStatement = documentType === 'bank_statement';
  return postVeryfi(isBankStatement ? '/bank-statements/' : '/documents', {
    file_data: fileData,
    categories,
    tags: [caseId],
  });
}

export function normalizeVeryfiResult({ filename, caseId, classification, extraction }) {
  const type = classification?.type || 'receipt';
  const isBankStatement = type === 'bank_statement';
  const confidence = Math.round((extraction?.confidence ?? classification?.score ?? 0.93) * 100);
  const fraudLevel = extraction?.fraud_level || 'low';
  const isDuplicate = Boolean(extraction?.is_duplicate);
  const isFlagged = isDuplicate || fraudLevel === 'medium' || fraudLevel === 'high' || confidence < 90;
  const documentId = extraction?.id ? `doc-${extraction.id}` : `doc-${Date.now()}`;

  const document = {
    id: documentId,
    caseId,
    originalFilename: filename,
    documentType: isBankStatement ? 'Bank Statement' : titleCase(type),
    veryfiId: String(extraction?.id || extraction?.veryfi_id || 'vf-live'),
    extractionStatus: isFlagged ? 'review' : 'complete',
    confidenceScore: confidence,
    isFlagged,
    flagReason: buildFlagReason({ isDuplicate, fraudLevel, confidence }),
    uploadedAt: new Date().toISOString(),
    thumbnailTone: isFlagged ? '#f7dfcf' : '#d9ead7',
  };

  const transactions = isBankStatement
    ? normalizeBankTransactions({ extraction, caseId, documentId })
    : [normalizeDocumentTransaction({ extraction, caseId, documentId, isDuplicate, fraudLevel })];

  return { document, transactions, classification, extraction };
}

export function mockVeryfiResult({ filename, caseId }) {
  const isBankStatement = filename.toLowerCase().includes('statement');
  const documentId = `doc-${Date.now()}`;
  const isDuplicate = filename.toLowerCase().includes('duplicate');
  const tamperingDetected = filename.toLowerCase().includes('altered') || filename.toLowerCase().includes('tamper');
  const confidence = tamperingDetected ? 84 : 95;

  return {
    document: {
      id: documentId,
      caseId,
      originalFilename: filename,
      documentType: isBankStatement ? 'Bank Statement' : 'Receipt',
      veryfiId: `vf_mock_${Date.now()}`,
      extractionStatus: isDuplicate || tamperingDetected || confidence < 90 ? 'review' : 'complete',
      confidenceScore: confidence,
      isFlagged: isDuplicate || tamperingDetected || confidence < 90,
      flagReason: buildFlagReason({
        isDuplicate,
        fraudLevel: tamperingDetected ? 'high' : 'low',
        confidence,
      }),
      uploadedAt: new Date().toISOString(),
      thumbnailTone: isDuplicate || tamperingDetected ? '#f7dfcf' : '#d9ead7',
    },
    transactions: isBankStatement
      ? [
          {
            id: `txn-${Date.now()}-1`,
            documentId,
            caseId,
            date: '2026-05-02',
            vendorName: 'Mock Bank Transaction',
            category: 'Medical',
            amount: 124.5,
            currency: 'USD',
            description: 'Transaction extracted from mocked bank statement response',
            lineItems: [{ item: 'Bank statement transaction', amount: 124.5 }],
            isDuplicate,
            tamperingDetected,
          },
        ]
      : [
          {
            id: `txn-${Date.now()}`,
            documentId,
            caseId,
            date: '2026-05-02',
            vendorName: 'City Medical Center',
            category: 'Medical',
            amount: 1240,
            currency: 'USD',
            description: 'Mocked Veryfi document extraction for local demo mode',
            lineItems: [
              { item: 'ER Visit', amount: 950 },
              { item: 'X-Ray', amount: 290 },
            ],
            isDuplicate,
            tamperingDetected,
          },
        ],
    classification: { type: isBankStatement ? 'bank_statement' : 'receipt', mode: 'mock' },
    extraction: { mode: 'mock' },
  };
}

function normalizeDocumentTransaction({ extraction, caseId, documentId, isDuplicate, fraudLevel }) {
  const lineItems = Array.isArray(extraction?.line_items)
    ? extraction.line_items.map((item) => ({
        item: item.description || item.text || item.name || 'Line item',
        amount: Number(item.total ?? item.amount ?? 0),
      }))
    : [];

  const amount = Number(extraction?.total ?? extraction?.total_amount ?? 0);

  return {
    id: `txn-${extraction?.id || Date.now()}`,
    documentId,
    caseId,
    date: extraction?.date || new Date().toISOString().slice(0, 10),
    vendorName: extraction?.vendor?.name || extraction?.vendor_name || 'Unknown vendor',
    category: inferCategory(extraction),
    amount,
    currency: 'USD',
    description: extraction?.document_title || extraction?.invoice_number || 'Extracted document transaction',
    lineItems: lineItems.length ? lineItems : [{ item: 'Document total', amount }],
    isDuplicate,
    tamperingDetected: fraudLevel === 'medium' || fraudLevel === 'high',
  };
}

function normalizeBankTransactions({ extraction, caseId, documentId }) {
  const bankTransactions = Array.isArray(extraction?.transactions) ? extraction.transactions : [];
  return bankTransactions.map((transaction, index) => {
    const amount = Math.abs(Number(transaction.amount ?? 0));
    return {
      id: `txn-${documentId}-${index}`,
      documentId,
      caseId,
      date: transaction.date || new Date().toISOString().slice(0, 10),
      vendorName: transaction.vendor_name || transaction.description || 'Bank transaction',
      category: inferCategory(transaction),
      amount,
      currency: 'USD',
      description: transaction.description || 'Bank statement transaction',
      lineItems: [{ item: transaction.description || 'Bank statement transaction', amount }],
      isDuplicate: false,
      tamperingDetected: false,
    };
  });
}

function inferCategory(record) {
  const text = `${record?.category || ''} ${record?.description || ''} ${record?.vendor?.name || ''}`.toLowerCase();

  if (text.includes('medical') || text.includes('pharmacy') || text.includes('hospital') || text.includes('clinic')) {
    return 'Medical';
  }

  if (text.includes('ride') || text.includes('taxi') || text.includes('parking')) {
    return 'Transportation';
  }

  if (text.includes('payroll') || text.includes('wage') || text.includes('deposit')) {
    return 'Lost Wages';
  }

  return 'Other';
}

function buildFlagReason({ isDuplicate, fraudLevel, confidence }) {
  if (isDuplicate) return 'Veryfi duplicate detection found a matching document';
  if (fraudLevel === 'medium' || fraudLevel === 'high') return `Veryfi fraud signal returned ${fraudLevel} risk`;
  if (confidence < 90) return 'Low confidence extraction requires attorney review';
  return undefined;
}

function titleCase(value) {
  return String(value)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
