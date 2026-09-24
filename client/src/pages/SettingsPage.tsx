import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, AlertCircle, Check, Key, Cpu, Globe, Sliders } from 'lucide-react';
import { getSettings, updateSettings } from '../utils/api';
import { Settings } from '../types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    plagiarismThreshold: 15,
    ngramSize: 5,
    enableWebCheck: false,
    llmProvider: 'openai',
    llmModel: 'gpt-3.5-turbo'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { settings } = await getSettings();
      setSettings(settings);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await updateSettings(settings);
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const llmModels: Record<string, string[]> = {
    openai: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o'],
    anthropic: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'],
    ollama: ['llama2', 'mistral', 'codellama', 'phi']
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-primary-600" />
          Settings
        </h1>
        <p className="text-gray-600 mt-1">Configure analysis parameters and LLM integration</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-4">
          <Check className="w-5 h-5" />
          {success}
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Sliders className="w-5 h-5 text-primary-600" />
          Analysis Settings
        </h3>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Plagiarism Threshold: {settings.plagiarismThreshold}%
            </label>
            <input
              type="range"
              min="5"
              max="50"
              value={settings.plagiarismThreshold}
              onChange={(e) => setSettings({ ...settings, plagiarismThreshold: Number(e.target.value) })}
              className="w-full accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5% (strict)</span>
              <span>50% (lenient)</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              N-gram Size
            </label>
            <select
              value={settings.ngramSize}
              onChange={(e) => setSettings({ ...settings, ngramSize: Number(e.target.value) })}
              className="input-field"
            >
              <option value={3}>3 (more sensitive — catches shorter matches)</option>
              <option value={5}>5 (balanced — recommended)</option>
              <option value={7}>7 (conservative — only longer matches)</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableWebCheck}
                onChange={(e) => setSettings({ ...settings, enableWebCheck: e.target.checked })}
                className="w-5 h-5 rounded accent-primary-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Globe className="w-4 h-4" />
                  Enable Web Search Checks
                </span>
                <p className="text-xs text-gray-500">
                  Opt-in: compares text against web sources (slower, requires internet)
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Cpu className="w-5 h-5 text-primary-600" />
          AI Fix Suggestions (LLM)
        </h3>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">LLM Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {(['openai', 'anthropic', 'ollama'] as const).map(provider => (
                <button
                  key={provider}
                  onClick={() => setSettings({
                    ...settings,
                    llmProvider: provider,
                    llmModel: llmModels[provider][0]
                  })}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition ${
                    settings.llmProvider === provider
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Claude' : 'Ollama (Local)'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {settings.llmProvider === 'ollama'
                ? 'Runs locally — no API key needed, requires Ollama installed'
                : 'Requires API key in .env file'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
            <select
              value={settings.llmModel}
              onChange={(e) => setSettings({ ...settings, llmModel: e.target.value })}
              className="input-field"
            >
              {(llmModels[settings.llmProvider] || llmModels.openai).map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <Key className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">API Keys</p>
              <p className="text-xs mt-1">
                Configure API keys in the <code className="bg-amber-100 px-1 rounded">server/.env</code> file:
              </p>
              <ul className="text-xs mt-1 list-disc list-inside">
                <li><code>OPENAI_API_KEY</code> for OpenAI</li>
                <li><code>ANTHROPIC_API_KEY</code> for Claude</li>
                <li><code>OLLAMA_URL</code> for local Ollama</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <p className="font-medium mb-1">Fallback Behavior</p>
            <p className="text-xs">
              If no LLM is configured or the API fails, the tool automatically uses rule-based
              paraphrasing (synonym replacement and sentence restructuring). Fixes will still work.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-primary-600" />
          Privacy & Data
        </h3>
        <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
          <li>All text analysis runs locally on your machine</li>
          <li>Your documents are never sent to external servers (except optional web checks)</li>
          <li>Check history is stored in a local SQLite database only when you choose to save</li>
          <li>API keys are stored in <code className="bg-gray-100 px-1 rounded">.env</code> files, never in the database</li>
          <li>Rate limiting is applied to prevent abuse of external API calls</li>
        </ul>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3"
      >
        <Save className="w-5 h-5" />
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}