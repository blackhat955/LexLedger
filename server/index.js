import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import {
  classifyDocument,
  extractDocument,
  hasVeryfiCredentials,
  mockVeryfiResult,
  normalizeVeryfiResult,
} from './veryfiClient.js';

dotenv.config();

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});
const port = Number(process.env.PORT || 8787);

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    veryfiConfigured: hasVeryfiCredentials(),
  });
});

app.post('/api/cases', (request, response) => {
  const title = request.body?.title || 'Untitled Legal Matter';
  response.status(201).json({
    id: `case-${Date.now()}`,
    title,
    caseType: request.body?.caseType || 'Personal Injury',
    clientName: request.body?.clientName || 'New Client',
    attorneyName: request.body?.attorneyName || 'Assigned Attorney',
    createdAt: new Date().toISOString(),
  });
});

app.post('/api/cases/:caseId/documents', upload.single('file'), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: 'file is required' });
      return;
    }

    const fileData = request.file.buffer.toString('base64');
    const payload = {
      filename: request.file.originalname,
      caseId: request.params.caseId,
    };

    if (!hasVeryfiCredentials()) {
      response.status(202).json({
        mode: 'mock',
        ...mockVeryfiResult(payload),
      });
      return;
    }

    const classification = await classifyDocument(fileData);
    const documentType = classification?.type || 'receipt';
    const extraction = await extractDocument({
      fileData,
      documentType,
      caseId: request.params.caseId,
    });

    response.status(201).json({
      mode: 'live',
      ...normalizeVeryfiResult({
        ...payload,
        classification,
        extraction,
      }),
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response) => {
  console.error(error);
  response.status(500).json({
    error: error instanceof Error ? error.message : 'Unexpected server error',
  });
});

app.listen(port, () => {
  console.log(`LexLedger API listening on http://localhost:${port}`);
  console.log(`Veryfi mode: ${hasVeryfiCredentials() ? 'live' : 'mock fallback'}`);
});
