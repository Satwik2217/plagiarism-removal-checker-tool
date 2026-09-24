import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { FileText, Upload, AlertCircle, Play, Loader2, Info } from 'lucide-react';
import { checkPlagiarism, getCorpus } from '../utils/api';
import { CitationStyle } from '../types';
import ProgressBar from '../components/ProgressBar';

const MIN_CHARS = 100;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const STAGES = [
  { at: 5, label: 'Reading your document...' },
  { at: 20, label: 'Detecting topic & keywords...' },
  { at: 35, label: 'Searching arXiv for related papers...' },
  { at: 55, label: 'Downloading & extracting sources...' },
  { at: 75, label: 'Comparing text against sources...' },
  { at: 90, label: 'Generating fix suggestions...' },
  { at: 100, label: 'Complete' }
];

export default function HomePage() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ stage: '', progress: 0 });
  const [error, setError] = useState('');
  const [fileWarning, setFileWarning] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [threshold, setThreshold] = useState(15);
  const [checkWeb, setCheckWeb] = useState(true);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('APA');
  const [corpusCount, setCorpusCount] = useState<number | null>(null);
  const progressTimer = useRef<number | null>(null);

  useEffect(() => {
    getCorpus().then(({ papers }) => setCorpusCount(papers.length)).catch(() => {});
    return () => { if (progressTimer.current) window.clearInterval(progressTimer.current); };
  }, []);

  const onDrop = useCallback((acceptedFiles: File[], rejections: any[]) => {
    setError('');
    setFileWarning('');
    if (rejections.length > 0) {
      const rej = rejections[0];
      if (rej.errors?.[0]?.code === 'file-too-large') {
        setError('File is too large (max 10MB). Please split into smaller chunks.');
      } else {
        setError('Unsupported file format. Allowed: .txt, .doc, .docx, .pdf');
      }
      return;
    }
    const file = acceptedFiles[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError('File is too large (max 10MB).');
      return;
    }
    setUploadedFile(file);
    setText('');
    if (file.name.toLowerCase().endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => setText(e.target?.result as string);
      reader.readAsText(file);
    }
    if (file.size > 1024 * 1024) {
      setFileWarning('Large file — analysis may take a bit longer.');
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
    maxSize: MAX_FILE_SIZE
  });

  const charCount = text.length;
  const isReady = charCount >= MIN_CHARS || !!uploadedFile;

  const handleCheck = async () => {
    if (!isReady) {
      setError(`Please enter at least ${MIN_CHARS} characters or upload a file.`);
      return;
    }
    setError('');
    setLoading(true);

    // Simulated progressive stages while awaiting the real result
    let stageIdx = 0;
    setProgress({ stage: STAGES[0].label, progress: STAGES[0].at });
    progressTimer.current = window.setInterval(() => {
      stageIdx = Math.min(stageIdx + 1, STAGES.length - 2);
      setProgress({ stage: STAGES[stageIdx].label, progress: STAGES[stageIdx].at });
    }, 2500);

      try {
        const result = await checkPlagiarism(text, {
          threshold,
          checkWeb,
          ngramSize: 5,
          citationStyle,
          file: uploadedFile || undefined,
          auto: true
        });

        if (progressTimer.current) window.clearInterval(progressTimer.current);
        setProgress({ stage: 'Complete', progress: 100 });

        // Store file buffer for modified export
        let fileBase64: string | undefined;
        if (uploadedFile) {
          const reader = new FileReader();
          fileBase64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(uploadedFile);
          });
          // Strip the data URL prefix to get just the base64
          fileBase64 = fileBase64.split(',')[1];
        }

        sessionStorage.setItem('checkResult', JSON.stringify(result));
        sessionStorage.setItem('checkMeta', JSON.stringify({
          threshold,
          checkWeb,
          citationStyle,
          filename: uploadedFile?.name || 'untitled.txt',
          fileBase64
        }));
        navigate('/results');
      } catch (err: any) {
      if (progressTimer.current) window.clearInterval(progressTimer.current);
      setError(err.message || 'Analysis failed. Please try again.');
      setProgress({ stage: '', progress: 0 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Plagiarism Checker</h1>
        <p className="mt-2 text-gray-600">
          Upload your paper — we detect the topic, search arXiv & the web, and check it automatically
        </p>
      </div>

      {/* Single big drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-primary-500 bg-primary-50 scale-[1.01]'
            : uploadedFile || text
            ? 'border-green-400 bg-green-50'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        {uploadedFile ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="w-8 h-8 text-green-600" />
            <div className="text-left">
              <p className="font-medium text-gray-900">{uploadedFile.name}</p>
              <p className="text-sm text-gray-500">{(uploadedFile.size / 1024).toFixed(0)} KB — ready to check</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setUploadedFile(null); setText(''); }}
              className="text-red-500 hover:text-red-700 text-sm ml-2"
            >
              Remove
            </button>
          </div>
        ) : isDragActive ? (
          <p className="text-primary-600 font-medium text-lg">Drop your paper here</p>
        ) : (
          <>
            <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
            <p className="font-medium text-gray-700">Drag & drop your research paper, or click to browse</p>
            <p className="text-sm text-gray-400 mt-1">PDF, DOCX, DOC, or TXT — max 10MB</p>
          </>
        )}
      </div>

      {/* Or paste text */}
      <details className="card" open={!uploadedFile && charCount > 0}>
        <summary className="cursor-pointer text-sm font-medium text-gray-600 select-none">
          Or paste text instead
        </summary>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setUploadedFile(null); }}
          placeholder="Paste your paper text here..."
          className="w-full h-40 mt-3 border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
          disabled={loading}
        />
        {text.length > 0 && (
          <p className={`text-xs mt-1 ${charCount >= MIN_CHARS ? 'text-green-600' : 'text-gray-400'}`}>
            {charCount.toLocaleString()} characters
          </p>
        )}
      </details>

      {fileWarning && (
        <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 rounded-lg p-3 text-sm">
          <AlertCircle className="w-4 h-4" /> {fileWarning}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="card">
          <ProgressBar progress={progress.progress} stage={progress.stage} />
          <p className="text-xs text-gray-400 mt-3 text-center">
            Automatically finding related papers — no setup needed
          </p>
        </div>
      )}

      <button
        onClick={handleCheck}
        disabled={loading || !isReady}
        className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-lg font-semibold"
      >
        {loading ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Checking...</>
        ) : (
          <><Play className="w-5 h-5" /> Check for Plagiarism</>
        )}
      </button>

      {!isReady && !loading && (
        <p className="text-center text-sm text-gray-400">
          Upload a file or paste {MIN_CHARS}+ characters to start
        </p>
      )}

      {/* Advanced — collapsed by default */}
      <div className="border-t pt-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mx-auto"
        >
          <Info className="w-4 h-4" />
          {showAdvanced ? 'Hide' : 'Show'} advanced settings
        </button>

        {showAdvanced && (
          <div className="card mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Threshold: {threshold}%
              </label>
              <input
                type="range" min="5" max="50" value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-primary-600"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Citation style</label>
              <select
                value={citationStyle}
                onChange={(e) => setCitationStyle(e.target.value as CitationStyle)}
                className="input-field"
                disabled={loading}
              >
                <option value="APA">APA</option>
                <option value="IEEE">IEEE</option>
                <option value="MLA">MLA</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Web search</label>
              <button
                onClick={() => setCheckWeb(!checkWeb)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  checkWeb ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600'
                }`}
                disabled={loading}
              >
                {checkWeb ? 'On — also check web pages' : 'Off — arXiv only (faster)'}
              </button>
            </div>
          </div>
        )}
      </div>

      {corpusCount !== null && corpusCount > 0 && (
        <p className="text-center text-xs text-gray-400">
          Also comparing against your {corpusCount} saved corpus paper{corpusCount !== 1 ? 's' : ''} ·{' '}
          <Link to="/corpus" className="underline">manage</Link>
        </p>
      )}
    </div>
  );
}
