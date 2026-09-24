import { useState } from 'react';
import { Wand2, Quote, X, Check, Edit3, RefreshCw } from 'lucide-react';
import { Match } from '../types';

interface FixEditorProps {
  match: Match;
  onApply: (matchId: string, text: string, suggestionIndex: number) => void;
  onRevert: (matchId: string) => void;
  onManualEdit: (matchId: string, text: string) => void;
  isApplied: boolean;
}

export default function FixEditor({ match, onApply, onRevert, onManualEdit, isApplied }: FixEditorProps) {
  const [selectedSuggestion, setSelectedSuggestion] = useState<number>(0);
  const [manualText, setManualText] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [localApplied, setLocalApplied] = useState(false);

  const suggestions = match.suggestions || [];
  const citations = match.citations || [];

  const handleApply = () => {
    const text = isManualMode ? manualText : (suggestions[selectedSuggestion] || '');
    if (!text) return;
    onApply(match.id, text, isManualMode ? -1 : selectedSuggestion);
    setLocalApplied(true);
  };

  const handleRevert = () => {
    onRevert(match.id);
    setLocalApplied(false);
  };

  const handleManualSave = () => {
    if (!manualText.trim()) return;
    onManualEdit(match.id, manualText.trim());
    setLocalApplied(true);
  };

  return (
    <div className="mt-4 border-t pt-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Original Text</span>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-gray-800 max-h-48 overflow-y-auto">
            {match.text}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <Quote className="w-3 h-3 inline mr-1" />
            Source: {match.source} ({match.confidence}%)
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Suggested Fix</span>
            <div className="flex gap-1">
              <button
                onClick={() => { setIsManualMode(false); setSelectedSuggestion((s) => (s + 1) % Math.max(1, suggestions.length)); }}
                disabled={suggestions.length === 0}
                className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 disabled:opacity-50"
                title="Next suggestion"
              >
                <RefreshCw className="w-3 h-3" /> Next
              </button>
              <button
                onClick={() => setIsManualMode(!isManualMode)}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                title="Manual edit"
              >
                <Edit3 className="w-3 h-3" /> Edit
              </button>
            </div>
          </div>

          {isManualMode ? (
            <div>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Type your rewritten version here..."
                className="w-full h-32 border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
              />
              <button
                onClick={handleManualSave}
                disabled={!manualText.trim()}
                className="mt-2 btn-primary text-xs py-1 px-3"
              >
                <Check className="w-3 h-3 inline mr-1" /> Save Manual Edit
              </button>
            </div>
          ) : (
            <div>
              {suggestions.length > 0 ? (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-gray-800 max-h-48 overflow-y-auto">
                    {suggestions[selectedSuggestion]}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-1">
                      {suggestions.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedSuggestion(i)}
                          className={`w-6 h-6 rounded text-xs font-medium ${
                            i === selectedSuggestion
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-gray-400">
                      {selectedSuggestion + 1} of {suggestions.length}
                    </span>
                  </div>
                </>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-500 text-center">
                  <Wand2 className="w-5 h-5 mx-auto mb-2 opacity-50" />
                  No suggestions yet. Click "Fix" to generate, or use manual edit.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {citations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-700 mb-1">Citation Recommendation</p>
          <p className="text-sm text-blue-900">{citations[0]}</p>
          {citations[1] && <p className="text-sm text-blue-800 italic mt-1">{citations[1]}</p>}
        </div>
      )}

      <div className="flex items-center gap-2">
        {!isApplied ? (
          <button
            onClick={handleApply}
            disabled={(!isManualMode && suggestions.length === 0) || (isManualMode && !manualText.trim())}
            className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1"
          >
            <Check className="w-4 h-4" />
            Apply This Fix
          </button>
        ) : (
          <>
            <span className="badge-green flex items-center gap-1">
              <Check className="w-3 h-3" /> Fix Applied
            </span>
            <button
              onClick={handleRevert}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Revert
            </button>
          </>
        )}
      </div>
    </div>
  );
}