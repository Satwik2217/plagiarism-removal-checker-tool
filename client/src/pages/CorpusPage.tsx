import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Database, Upload, Trash2, ToggleLeft, ToggleRight, AlertCircle,
  FileText, Plus, Search, Link2, Download, Loader2, ExternalLink, Sparkles
} from 'lucide-react';
import {
  getCorpus, uploadCorpusFile, uploadCorpusText, deleteCorpus, toggleCorpus,
  searchArxiv, importArxiv, importUrl, ArxivResult
} from '../utils/api';
import { CorpusPaper } from '../types';

type Tab = 'upload' | 'arxiv' | 'url' | 'text';

export default function CorpusPage() {
  const [papers, setPapers] = useState<CorpusPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState<Tab>('arxiv');
  const [uploading, setUploading] = useState(false);

  // Text paste
  const [textFilename, setTextFilename] = useState('');
  const [textContent, setTextContent] = useState('');

  // arXiv
  const [arxivQuery, setArxivQuery] = useState('');
  const [arxivResults, setArxivResults] = useState<ArxivResult[]>([]);
  const [arxivSearching, setArxivSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  // URL
  const [importUrlValue, setImportUrlValue] = useState('');

  const loadCorpus = async () => {
    try {
      setLoading(true);
      const { papers } = await getCorpus();
      setPapers(papers);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCorpus();
  }, []);

  const flashError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 8000);
  };
  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 6000);
  };

  // ---- file upload ----
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setError('');
    setSuccess('');
    setUploading(true);
    try {
      const result = await uploadCorpusFile(acceptedFiles[0]);
      flashSuccess(result.message);
      await loadCorpus();
    } catch (err: any) {
      flashError(err.message);
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024
  });

  // ---- text paste ----
  const handleTextUpload = async () => {
    if (!textFilename.trim() || !textContent.trim()) {
      flashError('Both filename and content are required');
      return;
    }
    setUploading(true);
    setError('');
    try {
      await uploadCorpusText(textFilename, textContent);
      flashSuccess(`Paper "${textFilename}" added to corpus`);
      setTextFilename('');
      setTextContent('');
      await loadCorpus();
    } catch (err: any) {
      flashError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ---- arXiv ----
  const handleArxivSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!arxivQuery.trim()) return;
    setArxivSearching(true);
    setError('');
    setArxivResults([]);
    try {
      const results = await searchArxiv(arxivQuery.trim(), 12);
      setArxivResults(results);
      if (results.length === 0) {
        flashError('No results found on arXiv for that query.');
      }
    } catch (err: any) {
      flashError(err.message);
    } finally {
      setArxivSearching(false);
    }
  };

  const handleArxivImport = async (item: ArxivResult) => {
    setImportingId(item.arxivId);
    setError('');
    try {
      const result = await importArxiv(item);
      flashSuccess(result.message);
      await loadCorpus();
    } catch (err: any) {
      flashError(err.message);
    } finally {
      setImportingId(null);
    }
  };

  const handleArxivImportAll = async () => {
    if (arxivResults.length === 0) return;
    if (!confirm(`Import all ${arxivResults.length} results? This may take a minute.`)) return;
    setImportingId('__all__');
    let ok = 0;
    let fail = 0;
    for (const item of arxivResults) {
      try {
        await importArxiv(item);
        ok++;
      } catch {
        fail++;
      }
    }
    setImportingId(null);
    flashSuccess(`Imported ${ok} paper(s)${fail ? `, ${fail} failed` : ''}.`);
    await loadCorpus();
  };

  // ---- URL ----
  const handleUrlImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrlValue.trim()) return;
    setUploading(true);
    setError('');
    try {
      const result = await importUrl(importUrlValue.trim());
      flashSuccess(result.message);
      setImportUrlValue('');
      await loadCorpus();
    } catch (err: any) {
      flashError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, filename: string) => {
    if (!confirm(`Delete "${filename}" from corpus?`)) return;
    try {
      await deleteCorpus(id);
      flashSuccess('Paper deleted');
      await loadCorpus();
    } catch (err: any) {
      flashError(err.message);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleCorpus(id);
      await loadCorpus();
    } catch (err: any) {
      flashError(err.message);
    }
  };

  const enabledCount = papers.filter(p => p.enabled).length;

  const tabs: Array<{ id: Tab; label: string; icon: any }> = [
    { id: 'arxiv', label: 'Search arXiv', icon: Search },
    { id: 'url', label: 'Import URL / DOI', icon: Link2 },
    { id: 'upload', label: 'Upload File', icon: Upload },
    { id: 'text', label: 'Paste Text', icon: Plus }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Database className="w-7 h-7 text-primary-600" />
          Corpus Management
        </h1>
        <p className="text-gray-600 mt-1">
          Add reference papers for plagiarism comparison — search arXiv, import URLs, or upload files
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {papers.length} paper{papers.length !== 1 ? 's' : ''} total, {enabledCount} enabled for checking
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-4">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto text-green-400 hover:text-green-600">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
              tab === id
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* arXiv Search */}
      {tab === 'arxiv' && (
        <div className="card">
          <h3 className="font-semibold flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary-600" />
            Search & Import from arXiv
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Free preprints from arXiv.org — enter your research topic to find related papers
          </p>

          <form onSubmit={handleArxivSearch} className="flex gap-2">
            <input
              type="text"
              value={arxivQuery}
              onChange={(e) => setArxivQuery(e.target.value)}
              placeholder='e.g. "deep learning traffic prediction" or "NLP sentiment analysis"'
              className="input-field flex-1"
            />
            <button
              type="submit"
              disabled={arxivSearching || !arxivQuery.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {arxivSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </form>

          {arxivResults.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{arxivResults.length} results</span>
                <button
                  onClick={handleArxivImportAll}
                  disabled={importingId !== null}
                  className="btn-secondary text-sm flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  Import all
                </button>
              </div>

              {arxivResults.map((item) => {
                const alreadyIn = papers.some(p => p.filename.includes(item.title.substring(0, 30)));
                return (
                  <div key={item.arxivId} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 line-clamp-2">{item.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.authors.slice(0, 3).join(', ')}
                          {item.authors.length > 3 && ` +${item.authors.length - 3} more`}
                          {' · '}{item.published}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{item.summary}</p>
                        <a
                          href={item.absUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1 mt-1"
                        >
                          <ExternalLink className="w-3 h-3" /> View on arXiv
                        </a>
                      </div>
                      <button
                        onClick={() => handleArxivImport(item)}
                        disabled={importingId !== null || alreadyIn}
                        className={`text-sm py-1.5 px-3 rounded-lg flex items-center gap-1 flex-shrink-0 ${
                          alreadyIn
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : 'btn-primary'
                        }`}
                      >
                        {importingId === item.arxivId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : alreadyIn ? (
                          <>✓ Added</>
                        ) : (
                          <><Download className="w-4 h-4" /> Import</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* URL / DOI import */}
      {tab === 'url' && (
        <div className="card">
          <h3 className="font-semibold flex items-center gap-2 mb-1">
            <Link2 className="w-5 h-5 text-primary-600" />
            Import from URL or DOI
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Paste any public link — arXiv abs page, researchgate, HTML article, PDF link, or a DOI like{' '}
            <code className="bg-gray-100 px-1 rounded">10.1145/3477495.3531662</code>
          </p>

          <form onSubmit={handleUrlImport} className="flex gap-2">
            <input
              type="text"
              value={importUrlValue}
              onChange={(e) => setImportUrlValue(e.target.value)}
              placeholder="https://arxiv.org/abs/2301.00001 or 10.1145/..."
              className="input-field flex-1"
            />
            <button
              type="submit"
              disabled={uploading || !importUrlValue.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Import
            </button>
          </form>

          <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <p className="font-medium">Tips:</p>
            <p>• PDF links and arXiv abstract pages work best</p>
            <p>• Many publisher pages are behind paywalls — use open-access links when possible</p>
            <p>• DOIs are auto-resolved via doi.org</p>
          </div>
        </div>
      )}

      {/* File upload */}
      {tab === 'upload' && (
        <div className="card">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-600">
              {uploading ? 'Uploading...' : isDragActive ? 'Drop here' : 'Drag & drop or click to upload'}
            </p>
            <p className="text-xs text-gray-400 mt-1">.txt, .doc, .docx, .pdf (max 10MB)</p>
          </div>
        </div>
      )}

      {/* Paste text */}
      {tab === 'text' && (
        <div className="card">
          <h3 className="font-semibold mb-3">Paste Text as a Paper</h3>
          <input
            type="text"
            value={textFilename}
            onChange={(e) => setTextFilename(e.target.value)}
            placeholder="Paper name (e.g., introduction-to-ml.txt)"
            className="input-field mb-3"
          />
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Paste paper content here..."
            className="w-full h-40 border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
          />
          <button
            onClick={handleTextUpload}
            disabled={uploading}
            className="btn-primary text-sm mt-3"
          >
            {uploading ? 'Adding...' : 'Add to Corpus'}
          </button>
        </div>
      )}

      {/* Paper list */}
      <div className="card">
        <h3 className="font-semibold mb-4">Corpus Papers ({papers.length})</h3>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : papers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No papers in corpus yet</p>
            <p className="text-sm">Search arXiv above to get started in one click</p>
          </div>
        ) : (
          <div className="space-y-2">
            {papers.map(paper => (
              <div
                key={paper.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                  paper.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
                }`}
              >
                <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{paper.filename}</p>
                  <p className="text-xs text-gray-400">
                    Added: {(paper.added_at || paper.addedAt || '').substring(0, 10)}
                  </p>
                </div>

                <span className={`text-xs font-medium ${paper.enabled ? 'badge-green' : 'bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full'}`}>
                  {paper.enabled ? 'Enabled' : 'Disabled'}
                </span>

                <button
                  onClick={() => handleToggle(paper.id)}
                  className={`p-1 rounded ${paper.enabled ? 'text-primary-600 hover:text-primary-800' : 'text-gray-400 hover:text-gray-600'}`}
                  title={paper.enabled ? 'Disable for checks' : 'Enable for checks'}
                >
                  {paper.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>

                <button
                  onClick={() => handleDelete(paper.id, paper.filename)}
                  className="p-1 text-red-400 hover:text-red-600"
                  title="Delete paper"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">How Corpus Checking Works</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li><strong>arXiv Search</strong> — find papers on your topic and import them automatically</li>
          <li><strong>URL / DOI import</strong> — paste any open-access link to fetch its text</li>
          <li>Only papers marked "Enabled" are included in plagiarism checks</li>
          <li>All processing happens locally — imported text stays on your machine</li>
        </ul>
      </div>
    </div>
  );
}
