import { useState, useEffect } from 'react';
import { History, Trash2, Eye, Calendar, AlertCircle, FileText } from 'lucide-react';
import { getHistory, deleteHistoryItem } from '../utils/api';
import { HistoryItem } from '../types';
import { getRiskColor, getRiskBadge, getRiskLabel } from '../utils/helpers';
import SkeletonLoader from '../components/SkeletonLoader';

export default function HistoryPage() {
  const [checks, setChecks] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const { checks } = await getHistory();
      setChecks(checks);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this history item?')) return;
    try {
      await deleteHistoryItem(id);
      setChecks(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <History className="w-7 h-7 text-primary-600" />
          Check History
        </h1>
        <p className="text-gray-600 mt-1">View your past plagiarism checks</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <SkeletonLoader lines={5} height="h-16" />
        </div>
      ) : checks.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium text-gray-600">No history yet</p>
          <p className="text-sm">Run a plagiarism check to see results here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {checks.map((check) => (
            <div key={check.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`text-2xl font-bold ${getRiskColor(check.similarity)}`}>
                    {check.similarity}%
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{check.filename}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(check.date).toLocaleDateString()} {new Date(check.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>{check.matches.length} match{check.matches.length !== 1 ? 'es' : ''}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskBadge(check.similarity)}`}>
                        {getRiskLabel(check.similarity)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpandedId(expandedId === check.id ? null : check.id)}
                    className="btn-secondary text-sm py-1 px-3 flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    {expandedId === check.id ? 'Hide' : 'Details'}
                  </button>
                  <button
                    onClick={() => handleDelete(check.id)}
                    className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandedId === check.id && (
                <div className="mt-4 border-t pt-4">
                  {check.matches.length === 0 ? (
                    <p className="text-green-600 text-sm">No matches found — text appears original.</p>
                  ) : (
                    <div className="space-y-2">
                      {check.matches.slice(0, 5).map((match, idx) => (
                        <div key={match.id || idx} className="text-sm bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-medium ${
                              match.confidence >= 70 ? 'text-red-600' :
                              match.confidence >= 40 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {match.confidence}% confidence
                            </span>
                            <span className="text-xs text-gray-400">{match.source}</span>
                          </div>
                          <p className="text-gray-700 line-clamp-2">
                            "{match.text.substring(0, 150)}{match.text.length > 150 ? '...' : ''}"
                          </p>
                        </div>
                      ))}
                      {check.matches.length > 5 && (
                        <p className="text-xs text-gray-400 text-center">
                          + {check.matches.length - 5} more matches
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}