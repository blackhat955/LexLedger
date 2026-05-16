# LexLedger

Legal evidence and expense reconstruction for Veryfi's take-home project.

LexLedger helps a paralegal upload case documents, extract structured financial data, reconstruct a chronological damages timeline, flag duplicate or suspicious evidence, and export a court-ready report.

## What This Demo Includes

- React + TypeScript frontend
- Node + Express backend
- Bulk document upload UI
- Server-side Veryfi integration boundary
- Automatic classify-then-route flow
- Mock fallback when Veryfi credentials are not present
- Dashboard, timeline, source document preview, and printable Evidence Report

## Veryfi Flow

All Veryfi calls happen in the backend so credentials never enter frontend code.

1. `POST /api/v8/partner/classify`
2. Route bank statements to `POST /api/v8/partner/bank-statements/`
3. Route receipts, invoices, medical bills, and other documents to `POST /api/v8/partner/documents`
4. Normalize the response into LexLedger documents and transactions
5. Surface `confidence`, `is_duplicate`, and `fraud_level` as legal review signals

The relevant code is in:

- `server/veryfiClient.js`
- `server/index.js`
- `src/services/api.ts`

## Setup

```bash
npm install
cp .env.example .env
npm run dev:full
```

Open:

```text
http://localhost:5173/
```

The API runs on:

```text
http://localhost:8787/
```

## Environment Variables

Add these values to `.env` from the Veryfi dashboard:

```bash
VERYFI_CLIENT_ID=
VERYFI_CLIENT_SECRET=
VERYFI_USERNAME=
VERYFI_API_KEY=
PORT=8787
```

If credentials are missing, the backend returns realistic mocked extraction data. That keeps the demo runnable for reviewers without exposing secrets.

## Demo Script

1. Open the dashboard and show the preloaded personal injury case.
2. Upload a receipt, invoice, or bank statement.
3. Point out that the backend classifies the document first, then routes it to the right Veryfi endpoint.
4. Open the timeline and show confidence, duplicate, and tampering flags.
5. Open Evidence Report and generate the printable PDF.

## Verification

```bash
npm run lint
npm run build
```

## Next Steps

- Persist cases, documents, and transactions in PostgreSQL
- Add authenticated case access and role-based permissions
- Generate server-side PDFs with Puppeteer or PDFKit
- Store source documents in private object storage
- Add immutable audit logs for evidence admissibility
