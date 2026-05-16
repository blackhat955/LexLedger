import {
  AlertTriangle,
  ArrowDownToLine,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  FileSearch,
  Filter,
  Gavel,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { currency, demoCase, documents as seededDocuments, simulatedUploads, transactions as seededTransactions } from './data';
import { uploadEvidenceDocument } from './services/api';
import type { DocumentType, EvidenceDocument, Transaction, UploadItem } from './types';

const categories = ['All', 'Medical', 'Transportation', 'Lost Wages', 'Other'];
const colors = ['#235789', '#2f8f83', '#d89c27', '#b5534b', '#5f5aa2'];

function summarizeByCategory(transactions: Transaction[]) {
  const totals = new Map<string, number>();
  transactions.forEach((transaction) => {
    totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + transaction.amount);
  });
  return Array.from(totals, ([name, value]) => ({ name, value }));
}

function summarizeByMonth(transactions: Transaction[]) {
  const totals = new Map<string, number>();
  transactions.forEach((transaction) => {
    const month = new Date(`${transaction.date}T00:00:00`).toLocaleString('en-US', { month: 'short' });
    totals.set(month, (totals.get(month) ?? 0) + transaction.amount);
  });
  return Array.from(totals, ([month, amount]) => ({ month, amount }));
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function inferDocumentType(filename: string): DocumentType {
  const name = filename.toLowerCase();
  if (name.includes('statement')) return 'Bank Statement';
  if (name.includes('invoice')) return 'Invoice';
  if (name.includes('bill')) return 'Medical Bill';
  if (name.includes('note') || name.includes('handwritten')) return 'Handwritten Note';
  return 'Receipt';
}

function getDocument(documents: EvidenceDocument[], documentId: string) {
  return documents.find((document) => document.id === documentId)!;
}

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'timeline' | 'report'>('dashboard');
  const [caseDocuments, setCaseDocuments] = useState<EvidenceDocument[]>(seededDocuments);
  const [caseTransactions, setCaseTransactions] = useState<Transaction[]>(seededTransactions);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>(simulatedUploads);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction>(seededTransactions[4]);
  const [query, setQuery] = useState('');

  const filteredTransactions = useMemo(() => {
    return caseTransactions
      .filter((transaction) => selectedCategory === 'All' || transaction.category === selectedCategory)
      .filter((transaction) => {
        const searchable = `${transaction.vendorName} ${transaction.description} ${transaction.category}`.toLowerCase();
        return searchable.includes(query.toLowerCase());
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [caseTransactions, query, selectedCategory]);

  const totals = useMemo(() => {
    const totalAmount = caseTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    const flagged = caseDocuments.filter((document) => document.isFlagged).length;
    const averageConfidence = Math.round(
      caseDocuments.reduce((sum, document) => sum + document.confidenceScore, 0) / caseDocuments.length,
    );
    return { totalAmount, flagged, averageConfidence };
  }, [caseDocuments, caseTransactions]);

  const activeDocument = getDocument(caseDocuments, selectedTransaction.documentId);

  async function handleFiles(files: FileList | File[]) {
    const incomingFiles = Array.from(files);

    for (const file of incomingFiles) {
      const queueId = `up-${file.name}-${Date.now()}`;
      const queuedItem: UploadItem = {
        id: queueId,
        filename: file.name,
        type: inferDocumentType(file.name),
        progress: 18,
        status: 'extracting',
      };

      setUploadQueue((current) => [queuedItem, ...current]);

      try {
        const result = await uploadEvidenceDocument(demoCase.id, file);
        setCaseDocuments((current) => [result.document, ...current]);
        setCaseTransactions((current) => [...result.transactions, ...current]);
        if (result.transactions[0]) {
          setSelectedTransaction(result.transactions[0]);
        }

        setUploadQueue((current) =>
          current.map((item) =>
            item.id === queueId
              ? {
                  ...item,
                  type: result.document.documentType,
                  progress: 100,
                  status: result.document.isFlagged ? 'review' : 'complete',
                  confidence: result.document.confidenceScore,
                }
              : item,
          ),
        );
      } catch (error) {
        setUploadQueue((current) =>
          current.map((item) =>
            item.id === queueId
              ? {
                  ...item,
                  progress: 100,
                  status: 'review',
                  error: error instanceof Error ? error.message : 'Upload failed',
                }
              : item,
          ),
        );
      }
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Gavel size={28} />
          <div>
            <strong>LexLedger</strong>
            <span>Evidence reconstruction</span>
          </div>
        </div>

        <nav className="nav" aria-label="Main navigation">
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
            <ClipboardList size={18} /> Dashboard
          </button>
          <button className={activeTab === 'timeline' ? 'active' : ''} onClick={() => setActiveTab('timeline')}>
            <CalendarDays size={18} /> Timeline
          </button>
          <button className={activeTab === 'report' ? 'active' : ''} onClick={() => setActiveTab('report')}>
            <FileCheck2 size={18} /> Evidence Report
          </button>
        </nav>

        <section className="case-panel">
          <span>Active case</span>
          <h2>{demoCase.title}</h2>
          <dl>
            <div>
              <dt>Client</dt>
              <dd>{demoCase.clientName}</dd>
            </div>
            <div>
              <dt>Case type</dt>
              <dd>{demoCase.caseType}</dd>
            </div>
            <div>
              <dt>Attorney</dt>
              <dd>{demoCase.attorneyName}</dd>
            </div>
          </dl>
        </section>

        <div className="compliance">
          <ShieldCheck size={18} />
          <span>SOC 2-ready workflow with no human review in the OCR loop.</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Veryfi take-home demo</span>
            <h1>Legal evidence and expense reconstruction</h1>
          </div>
          <div className="top-actions">
            <button className="icon-button" title="New case">
              <Plus size={18} />
            </button>
            <button className="primary" onClick={() => setActiveTab('report')}>
              <ArrowDownToLine size={18} /> Export PDF
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <Dashboard
            totalAmount={totals.totalAmount}
            flagged={totals.flagged}
            averageConfidence={totals.averageConfidence}
            documentsCount={caseDocuments.length}
            uploadQueue={uploadQueue}
            transactions={caseTransactions}
            onFilesSelected={handleFiles}
            onOpenTimeline={() => setActiveTab('timeline')}
          />
        )}

        {activeTab === 'timeline' && (
          <Timeline
            query={query}
            setQuery={setQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            filteredTransactions={filteredTransactions}
            selectedTransaction={selectedTransaction}
            setSelectedTransaction={setSelectedTransaction}
            activeDocument={activeDocument}
          />
        )}

        {activeTab === 'report' && (
          <Report
            selectedTransaction={selectedTransaction}
            activeDocument={activeDocument}
            documents={caseDocuments}
            transactions={caseTransactions}
          />
        )}
      </section>
    </main>
  );
}

function Dashboard({
  totalAmount,
  flagged,
  averageConfidence,
  documentsCount,
  uploadQueue,
  transactions,
  onFilesSelected,
  onOpenTimeline,
}: {
  totalAmount: number;
  flagged: number;
  averageConfidence: number;
  documentsCount: number;
  uploadQueue: UploadItem[];
  transactions: Transaction[];
  onFilesSelected: (files: FileList | File[]) => void;
  onOpenTimeline: () => void;
}) {
  const categoryData = summarizeByCategory(transactions);
  const monthData = summarizeByMonth(transactions);

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (event.dataTransfer.files.length) {
      onFilesSelected(event.dataTransfer.files);
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) {
      onFilesSelected(event.target.files);
      event.target.value = '';
    }
  }

  return (
    <div className="content-grid">
      <section className="upload-band">
        <label className="upload-zone" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
          <input type="file" multiple accept=".pdf,image/*" onChange={handleFileInput} />
          <Upload size={26} />
          <div>
            <h2>Drop case documents</h2>
            <p>PDFs, receipts, invoices, bank statements, medical bills, and handwritten notes are routed to the right Veryfi extraction endpoint.</p>
          </div>
        </label>
        <div className="upload-queue">
          {uploadQueue.map((item) => (
            <div className="upload-item" key={item.id}>
              <div className="file-icon">
                <FileSearch size={18} />
              </div>
              <div>
                <strong>{item.filename}</strong>
                <span>
                  {item.type} ·{' '}
                  {item.error
                    ? item.error
                    : item.status === 'extracting'
                      ? 'Classifying and extracting through backend'
                      : `${item.confidence}% confidence`}
                </span>
                <div className="progress">
                  <div style={{ width: `${item.progress}%` }} />
                </div>
              </div>
              {item.status === 'review' ? <AlertTriangle className="warn" size={18} /> : <CheckCircle2 className="ok" size={18} />}
            </div>
          ))}
        </div>
      </section>

      <section className="stats-row">
        <Stat icon={<CircleDollarSign size={20} />} label="Economic damages" value={currency.format(totalAmount)} />
        <Stat icon={<FileCheck2 size={20} />} label="Documents processed" value={String(documentsCount)} />
        <Stat icon={<AlertTriangle size={20} />} label="Flagged items" value={String(flagged)} />
        <Stat icon={<ShieldCheck size={20} />} label="Avg. confidence" value={`${averageConfidence}%`} />
      </section>

      <section className="chart-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Summary</span>
            <h2>Damages by category</h2>
          </div>
          <button className="text-button" onClick={onOpenTimeline}>
            Open timeline <ChevronRight size={16} />
          </button>
        </div>
        <div className="chart-layout">
          <ResponsiveContainer width="100%" height={270}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={4}>
                {categoryData.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => currency.format(value)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend">
            {categoryData.map((entry, index) => (
              <div key={entry.name}>
                <span style={{ background: colors[index % colors.length] }} />
                <strong>{entry.name}</strong>
                <em>{currency.format(entry.value)}</em>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="chart-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Timeline</span>
            <h2>Month-over-month reconstruction</h2>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={310}>
          <BarChart data={monthData} margin={{ top: 18, right: 24, left: 0, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${Number(value) / 1000}k`} />
            <Tooltip formatter={(value: number) => currency.format(value)} />
            <Bar dataKey="amount" fill="#235789" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="stat">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <em>{label}</em>
      </div>
    </div>
  );
}

function Timeline({
  query,
  setQuery,
  selectedCategory,
  setSelectedCategory,
  filteredTransactions,
  selectedTransaction,
  setSelectedTransaction,
  activeDocument,
}: {
  query: string;
  setQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  filteredTransactions: Transaction[];
  selectedTransaction: Transaction;
  setSelectedTransaction: (transaction: Transaction) => void;
  activeDocument: EvidenceDocument;
}) {
  return (
    <div className="timeline-layout">
      <section className="filter-panel">
        <div className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search vendor or note" />
        </div>
        <div className="filter-title">
          <Filter size={17} /> Filters
        </div>
        <div className="segments">
          {categories.map((category) => (
            <button key={category} className={selectedCategory === category ? 'active' : ''} onClick={() => setSelectedCategory(category)}>
              {category}
            </button>
          ))}
        </div>
        <label className="check-row">
          <input type="checkbox" defaultChecked /> Flag anomalies
        </label>
        <label className="check-row">
          <input type="checkbox" defaultChecked /> Show source document
        </label>
      </section>

      <section className="timeline-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Chronological log</span>
            <h2>{filteredTransactions.length} extracted transactions</h2>
          </div>
        </div>
        <div className="transaction-list">
          {filteredTransactions.map((transaction) => (
            <button
              className={`transaction-row ${selectedTransaction.id === transaction.id ? 'selected' : ''}`}
              key={transaction.id}
              onClick={() => setSelectedTransaction(transaction)}
            >
              <span className="date-chip">{formatDate(transaction.date)}</span>
              <span>
                <strong>{transaction.vendorName}</strong>
                <em>{transaction.description}</em>
              </span>
              <span className="category-chip">{transaction.category}</span>
              <strong>{currency.format(transaction.amount)}</strong>
              {(transaction.isDuplicate || transaction.tamperingDetected) && <AlertTriangle className="warn" size={18} />}
            </button>
          ))}
        </div>
      </section>

      <DocumentPreview transaction={selectedTransaction} document={activeDocument} />
    </div>
  );
}

function DocumentPreview({ transaction, document }: { transaction: Transaction; document: EvidenceDocument }) {
  return (
    <aside className="document-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Source document</span>
          <h2>{document.documentType}</h2>
        </div>
        <span className={document.isFlagged ? 'risk-badge' : 'clean-badge'}>
          {document.isFlagged ? 'Review' : 'Clean'}
        </span>
      </div>
      <div className="document-preview" style={{ background: document.thumbnailTone }}>
        <div className="paper">
          <span>{document.originalFilename}</span>
          <strong>{transaction.vendorName}</strong>
          <div />
          <div />
          <div />
          <b>{currency.format(transaction.amount)}</b>
        </div>
      </div>
      <dl className="extraction-grid">
        <div>
          <dt>Veryfi ID</dt>
          <dd>{document.veryfiId}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{document.confidenceScore}%</dd>
        </div>
        <div>
          <dt>Vendor</dt>
          <dd>{transaction.vendorName}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatDate(transaction.date)}</dd>
        </div>
      </dl>
      {document.flagReason && (
        <div className="flag-box">
          <AlertTriangle size={18} />
          <span>{document.flagReason}</span>
        </div>
      )}
      <div className="line-items">
        <h3>Line items</h3>
        {transaction.lineItems.map((item) => (
          <div key={item.item}>
            <span>{item.item}</span>
            <strong>{currency.format(item.amount)}</strong>
          </div>
        ))}
      </div>
    </aside>
  );
}

function Report({
  selectedTransaction,
  activeDocument,
  documents,
  transactions,
}: {
  selectedTransaction: Transaction;
  activeDocument: EvidenceDocument;
  documents: EvidenceDocument[];
  transactions: Transaction[];
}) {
  const flaggedTransactions = transactions.filter((transaction) => transaction.isDuplicate || transaction.tamperingDetected);
  const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

  return (
    <div className="report-layout">
      <section className="report-preview">
        <div className="report-paper">
          <header>
            <div>
              <span>Evidence Report</span>
              <h2>{demoCase.title}</h2>
            </div>
            <Gavel size={34} />
          </header>
          <section className="report-summary">
            <div>
              <strong>{demoCase.clientName}</strong>
              <span>Client</span>
            </div>
            <div>
              <strong>{currency.format(total)}</strong>
              <span>Claimed economic damages</span>
            </div>
            <div>
              <strong>{documents.length}</strong>
              <span>Source documents</span>
            </div>
            <div>
              <strong>{flaggedTransactions.length}</strong>
              <span>Evidence flags</span>
            </div>
          </section>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Vendor</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{formatDate(transaction.date)}</td>
                  <td>{transaction.vendorName}</td>
                  <td>{transaction.category}</td>
                  <td>{currency.format(transaction.amount)}</td>
                  <td>{getDocument(documents, transaction.documentId).veryfiId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="export-panel">
        <h2>Court-ready export</h2>
        <p>The report includes the summary table, transaction log, confidence notes, anomaly flags, and source-document audit trail.</p>
        <button className="primary wide" onClick={() => window.print()}>
          <ArrowDownToLine size={18} /> Generate PDF
        </button>
        <div className="export-checks">
          <span><Banknote size={17} /> Damages totaled by category</span>
          <span><AlertTriangle size={17} /> Duplicate and tampering flags</span>
          <span><LockKeyhole size={17} /> No human in the OCR loop</span>
          <span><BriefcaseBusiness size={17} /> Attorney-facing audit trail</span>
        </div>
        <DocumentPreview transaction={selectedTransaction} document={activeDocument} />
      </aside>
    </div>
  );
}
