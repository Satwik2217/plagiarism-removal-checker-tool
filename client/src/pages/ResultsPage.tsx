import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, CheckCircle, AlertCircle, BookOpen, Copy } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { CheckResult, Match, AppliedFix, CitationStyle, ExportType } from '../types';
import { buildHighlightedText, applyFixesToText, getRiskColor, getRiskBadge, getRiskLabel, getRiskBg, downloadBlob, generateFallbackFix } from '../utils/helpers';
import { exportDocumentModify, exportReport, saveCheck, checkPlagiarism } from '../utils/api';
import FixEditor from '../components/FixEditor';

export default function ResultsPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<CheckResult | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [appliedFixes, setAppliedFixes] = useState<AppliedFix[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHighlights, setShowHighlights] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('checkResult');
    const storedMeta = sessionStorage.getItem('checkMeta');

    if (!stored) {
      navigate('/');
      return;
    }

    try {
      setResult(JSON.parse(stored));
      if (storedMeta) setMeta(JSON.parse(storedMeta));
    } catch {
      navigate('/');
    }
  }, [navigate]);

  const matches = result?.matches || [];
  const similarity = result?.similarity || 0;
  const originalText = result?.originalText || '';

  // Auto-apply the first suggestion for every match so "changes made" is never stuck at 0
  useEffect(() => {
    if (!result || !result.matches || result.matches.length === 0) return;
    const autoFixes: AppliedFix[] = [];
    for (const match of result.matches) {
      if (match.suggestions && match.suggestions.length > 0) {
        autoFixes.push({
          matchId: match.id,
          originalText: match.text,
          fixedText: match.suggestions[0],
          suggestionIndex: 0
        });
      } else if (match.text) {
        // Generate a fallback fix when no LLM suggestions are available
        autoFixes.push({
          matchId: match.id,
          originalText: match.text,
          fixedText: generateFallbackFix(match.text),
          suggestionIndex: -1
        });
      }
    }
    if (autoFixes.length > 0) {
      setAppliedFixes(autoFixes);
    }
  }, [result]);

  const highlightedSegments = useMemo(() => {
    if (!originalText || !showHighlights) return [{ text: originalText }];
    return buildHighlightedText(originalText, matches, appliedFixes);
  }, [originalText, matches, appliedFixes, showHighlights]);

  const fixedText = useMemo(() => {
    return applyFixesToText(originalText, appliedFixes);
  }, [originalText, appliedFixes]);

  const paragraphBreakdown = useMemo(() => {
    if (!originalText) return [];
    const paragraphs = originalText.split(/\n\s*\n|\n/).filter(p => p.trim().length > 0);
    return paragraphs.map((para, idx) => {
      const paraStart = originalText.indexOf(para);
      const paraEnd = paraStart + para.length;
      const paraMatches = matches.filter(m => m.startIndex >= paraStart && m.endIndex <= paraEnd);
      const matchedChars = paraMatches.reduce((sum, m) => sum + (m.endIndex - m.startIndex), 0);
      const paraSimilarity = para.length > 0 ? Math.round((matchedChars / para.length) * 100) : 0;
      return {
        index: idx + 1,
        preview: para.substring(0, 80) + (para.length > 80 ? '...' : ''),
        similarity: Math.min(100, paraSimilarity),
        matchCount: paraMatches.length
      };
    }).filter(p => p.matchCount > 0 || p.similarity > 0);
  }, [originalText, matches]);

  const chartData = useMemo(() => {
    const matched = matches.reduce((sum, m) => sum + (m.endIndex - m.startIndex), 0);
    const total = originalText.length || 1;
    const original = Math.max(0, 100 - similarity);
    return [
      { name: 'Original', value: original, color: '#22c55e' },
      { name: 'Matched', value: similarity, color: similarity >= 30 ? '#ef4444' : similarity >= 15 ? '#eab308' : '#22c55e' }
    ];
  }, [similarity, matches, originalText]);

  const confidenceData = useMemo(() => {
    const buckets = { '0-25%': 0, '26-50%': 0, '51-75%': 0, '76-100%': 0 };
    matches.forEach(m => {
      if (m.confidence <= 25) buckets['0-25%']++;
      else if (m.confidence <= 50) buckets['26-50%']++;
      else if (m.confidence <= 75) buckets['51-75%']++;
      else buckets['76-100%']++;
    });
    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, [matches]);

  const handleApplyFix = (matchId: string, suggestionText: string, suggestionIndex: number) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    setAppliedFixes(prev => {
      const existing = prev.findIndex(f => f.matchId === matchId);
      const fix: AppliedFix = {
        matchId,
        originalText: match.text,
        fixedText: suggestionText,
        suggestionIndex
      };
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = fix;
        return updated;
      }
      return [...prev, fix];
    });
  };

  const handleRevertFix = (matchId: string) => {
    setAppliedFixes(prev => prev.filter(f => f.matchId !== matchId));
  };

  const handleManualEdit = (matchId: string, editedText: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    setAppliedFixes(prev => {
      const existing = prev.findIndex(f => f.matchId === matchId);
      const fix: AppliedFix = {
        matchId,
        originalText: match.text,
        fixedText: editedText,
        suggestionIndex: -1
      };
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = fix;
        return updated;
      }
      return [...prev, fix];
    });
  };

  const fetchAllSuggestions = async () => {
    if (!matches.length) return;
    try {
      const enriched = await checkPlagiarism(originalText, {
        threshold: meta?.threshold || 15,
        checkWeb: meta?.checkWeb || false,
        ngramSize: meta?.ngramSize || 5,
        citationStyle: meta?.citationStyle || 'APA'
      });
      setResult(prev => prev ? { ...prev, matches: enriched.matches } : prev);
      sessionStorage.setItem('checkResult', JSON.stringify({ ...result, matches: enriched.matches }));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExport = async (type: ExportType) => {
    setExporting(true);
    setError('');
    try {
      const meta = JSON.parse(sessionStorage.getItem('checkMeta') || '{}');
      const blob = await exportDocumentModify(
        type,
        meta?.filename || 'document',
        fixedText,
        matches
      );
      downloadBlob(blob, `${(meta?.filename || 'document').replace(/\.[^.]+$/, '')}.${type}`);
    } catch (err: any) {
      setError(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportReport = async () => {
    setExporting(true);
    setError('');
    try {
      const blob = await exportReport(
        meta?.filename || 'document',
        similarity,
        matches,
        originalText,
        fixedText,
        appliedFixes.length
      );
      downloadBlob(blob, `${(meta?.filename || 'document').replace(/\.[^.]+$/, '')}-report.pdf`);
    } catch (err: any) {
      setError(`Report export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCheck(meta?.filename || 'untitled', originalText, similarity, matches, true);
      setError('');
      alert('Check saved to history successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!result) {
    return <div className="text-center py-12 text-gray-500">Loading results...</div>;
  }

  const hasSuggestions = matches.some(m => m.suggestions && m.suggestions.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          New Check
        </button>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-secondary text-sm">
            {saving ? 'Saving...' : 'Save to History'}
          </button>
          <button onClick={() => handleExport('docx')} disabled={exporting} className="btn-secondary text-sm">
            <Download className="w-4 h-4 inline mr-1" /> DOCX
          </button>
          <button onClick={() => handleExport('pdf')} disabled={exporting} className="btn-secondary text-sm">
            <Download className="w-4 h-4 inline mr-1" /> PDF
          </button>
          <button onClick={handleExportReport} disabled={exporting} className="btn-primary text-sm">
            <FileText className="w-4 h-4 inline mr-1" /> Report
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {result.topic && (
        <div className="card bg-gray-50">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Detected Topic</p>
              <p className="font-semibold text-gray-900 mt-1">{result.topic.title}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {result.topic.keywords.slice(0, 8).map(kw => (
                  <span key={kw} className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">{kw}</span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sources Checked</p>
              <p className="text-2xl font-bold text-gray-900">{result.sourcesChecked?.length ?? result.corpusCount ?? 0}</p>
            </div>
          </div>
          {result.sourcesChecked && result.sourcesChecked.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs font-medium text-gray-500 mb-2">Auto-gathered sources</p>
              <div className="flex flex-wrap gap-2">
                {result.sourcesChecked.map((src, i) => (
                  <a
                    key={i}
                    href={src.url || undefined}
                    target={src.url ? '_blank' : undefined}
                    rel="noreferrer"
                    className={`text-xs px-2 py-1 rounded-lg border ${
                      src.origin === 'arxiv' ? 'border-orange-200 bg-orange-50 text-orange-700' :
                      src.origin === 'web' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                      'border-green-200 bg-green-50 text-green-700'
                    } ${src.url ? 'hover:underline' : ''}`}
                    title={src.url || src.name}
                  >
                    {src.origin === 'arxiv' ? '📄' : src.origin === 'web' ? '🌐' : '📁'}{' '}
                    {src.name.length > 55 ? src.name.substring(0, 55) + '…' : src.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Overall Similarity</h3>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold ${getRiskColor(similarity)}`}>
              {similarity}%
            </span>
            <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${getRiskBadge(similarity)}`}>
              {getRiskLabel(similarity)}
            </span>
          </div>
          <div className="mt-3 w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${getRiskBg(similarity)}`}
              style={{ width: `${similarity}%` }}
            />
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Matches Found</h3>
          <div className="text-4xl font-bold text-gray-900">{matches.length}</div>
          <p className="text-sm text-gray-500 mt-1">
            {appliedFixes.length} fix{appliedFixes.length !== 1 ? 'es' : ''} applied
          </p>
        </div>

        <div className="card">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Breakdown</h3>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {confidenceData.some(d => d.count > 0) && (
        <div className="card">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Match Confidence Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confidenceData}>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary-600" />
              Highlighted Text
            </h3>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showHighlights}
                onChange={(e) => setShowHighlights(e.target.checked)}
                className="rounded accent-primary-600"
              />
              Show highlights
            </label>
          </div>
          <div className="max-h-96 overflow-y-auto scrollbar-thin p-4 bg-gray-50 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
            {highlightedSegments.map((seg, idx) => {
              if (!seg.matchId) return <span key={idx}>{seg.text}</span>;
              const match = matches.find(m => m.id === seg.matchId);
              return (
                <span
                  key={idx}
                  onClick={() => match && setSelectedMatch(match)}
                  className={seg.isApplied ? 'highlight-applied' : 'highlight-match'}
                  title={match ? `${match.source} — ${match.confidence}% confidence` : ''}
                >
                  {seg.text}
                </span>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Fixed Document ({appliedFixes.length} changes)
            </h3>
            <button
              onClick={() => navigator.clipboard.writeText(fixedText)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto scrollbar-thin p-4 bg-green-50 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
            {fixedText || originalText}
          </div>
        </div>
      </div>

      {paragraphBreakdown.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4">Paragraph Breakdown</h3>
          <div className="space-y-2">
            {paragraphBreakdown.map(p => (
              <div key={p.index} className="flex items-center gap-3 text-sm">
                <span className="w-8 text-gray-400 font-mono">#{p.index}</span>
                <span className="flex-1 text-gray-600 truncate">{p.preview}</span>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getRiskBg(p.similarity)}`}
                    style={{ width: `${p.similarity}%` }}
                  />
                </div>
                <span className={`w-12 text-right font-medium ${getRiskColor(p.similarity)}`}>
                  {p.similarity}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Matches & Sources ({matches.length})</h3>
           {!hasSuggestions && matches.length > 0 && (
             <button
               onClick={fetchAllSuggestions}
               className="btn-primary text-sm"
             >
               Generate All Suggestions
             </button>
           )}
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-600" />
            <p className="font-medium text-green-700">No significant overlap found</p>
            <div className="mt-2 text-sm text-gray-600 max-w-lg mx-auto space-y-1">
              <p>
                Compared against{' '}
                <strong>{result.sourcesChecked?.length ?? result.corpusCount ?? 0} automatically-gathered sources</strong>
                {result.topic ? ` for "${result.topic.title}"` : ''}.
              </p>
              <p className="text-gray-500">
                This is a strong signal of originality, but not a guarantee — for submission,
                your institution's official checker (e.g. Turnitin) should still be used.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match, idx) => (
              <div
                key={match.id}
                className={`border rounded-lg p-4 transition ${
                  selectedMatch?.id === match.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-gray-400">#{idx + 1}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        match.confidence >= 70 ? 'bg-red-100 text-red-700' :
                        match.confidence >= 40 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {match.confidence}% confidence
                      </span>
                      {appliedFixes.some(f => f.matchId === match.id) && (
                        <span className="badge-green">Fixed</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded p-2 mb-2 line-clamp-3">
                      "{match.text.substring(0, 200)}{match.text.length > 200 ? '...' : ''}"
                    </p>
                    <p className="text-xs text-gray-500">
                      Source: <span className="font-medium">{match.source}</span>
                    </p>
                    {match.citations && match.citations.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500 bg-blue-50 rounded p-2">
                        <p className="font-medium text-blue-700 mb-1">Suggested Citation ({meta?.citationStyle || 'APA'}):</p>
                        <p>{match.citations[0]}</p>
                        {match.citations[1] && <p className="mt-1 italic">{match.citations[1]}</p>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setSelectedMatch(selectedMatch?.id === match.id ? null : match)}
                      className="btn-secondary text-xs py-1 px-3"
                    >
                      {selectedMatch?.id === match.id ? 'Close' : 'Fix'}
                    </button>
                  </div>
                </div>

                {selectedMatch?.id === match.id && (
                  <FixEditor
                    match={match}
                    onApply={handleApplyFix}
                    onRevert={handleRevertFix}
                    onManualEdit={handleManualEdit}
                    isApplied={appliedFixes.some(f => f.matchId === match.id)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}