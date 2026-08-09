import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

const METRICS_BY_DOMAIN = {
  weather: ['temperature_f', 'precipitation_mm', 'wind_mph', 'snowfall_cm'],
  sports: ['score_diff', 'score_home', 'score_away'],
  crypto: ['price_usd'],
};

const OPERATORS = ['>', '>=', '<', '<=', '==', '!='];

export default function CreateTrigger() {
  const navigate = useNavigate();
  const [rawPrompt, setRawPrompt] = useState('');
  const [parsed, setParsed] = useState(null);
  const [recurring, setRecurring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleParse(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.post('/api/triggers/parse', { raw_prompt: rawPrompt });
      setParsed(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateSubjectField(field, value) {
    setParsed({ ...parsed, subject: { ...parsed.subject, [field]: value } });
  }

  function updateConditionField(field, value) {
    setParsed({ ...parsed, condition: { ...parsed.condition, [field]: value } });
  }

  function changeDomain(domain) {
    setParsed({
      domain,
      subject: {},
      condition: { metric: METRICS_BY_DOMAIN[domain]?.[0], operator: '>', threshold: 0, edge_trigger: false },
      unsupported_reason: null,
    });
  }

  async function handleCreate() {
    setError('');
    setLoading(true);
    try {
      await api.post('/api/triggers', { raw_prompt: rawPrompt, ...parsed, recurring, channels: ['push'] });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack create-trigger">
      <h2>New trigger</h2>

      <form onSubmit={handleParse} className="stack">
        <textarea
          placeholder="e.g. Let me know when it stops raining in Boston"
          value={rawPrompt}
          onChange={(e) => setRawPrompt(e.target.value)}
          rows={3}
          required
        />
        <button type="submit" className="button button-primary" disabled={loading}>
          Continue
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {parsed && (
        <div className="card confirm-card stack">
          <div className="row">
            <label>Domain</label>
            <select value={parsed.domain} onChange={(e) => changeDomain(e.target.value)}>
              <option value="weather">Weather</option>
              <option value="sports">Sports</option>
              <option value="crypto">Crypto</option>
              <option value="unsupported">Unsupported</option>
            </select>
          </div>

          {parsed.domain === 'unsupported' ? (
            <p className="error-text">{parsed.unsupported_reason || "This request isn't supported yet."}</p>
          ) : (
            <>
              {parsed.domain === 'weather' && (
                <input
                  placeholder="Location"
                  value={parsed.subject.location || ''}
                  onChange={(e) => updateSubjectField('location', e.target.value)}
                />
              )}

              {parsed.domain === 'sports' && (
                <>
                  <input
                    placeholder="Team"
                    value={parsed.subject.team || ''}
                    onChange={(e) => updateSubjectField('team', e.target.value)}
                  />
                  <input
                    placeholder="Opponent (optional)"
                    value={parsed.subject.opponent || ''}
                    onChange={(e) => updateSubjectField('opponent', e.target.value)}
                  />
                </>
              )}

              {parsed.domain === 'crypto' && (
                <input
                  placeholder="Coin id (e.g. bitcoin)"
                  value={parsed.subject.coin_id || ''}
                  onChange={(e) => updateSubjectField('coin_id', e.target.value)}
                />
              )}

              <div className="row condition-row">
                <select
                  value={parsed.condition.metric}
                  onChange={(e) => updateConditionField('metric', e.target.value)}
                >
                  {METRICS_BY_DOMAIN[parsed.domain]?.map((metric) => (
                    <option key={metric} value={metric}>
                      {metric}
                    </option>
                  ))}
                </select>
                <select
                  value={parsed.condition.operator}
                  onChange={(e) => updateConditionField('operator', e.target.value)}
                >
                  {OPERATORS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={parsed.condition.threshold}
                  onChange={(e) => updateConditionField('threshold', Number(e.target.value))}
                />
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={parsed.condition.edge_trigger}
                  onChange={(e) => updateConditionField('edge_trigger', e.target.checked)}
                />
                Only alert on the transition (e.g. "stops raining"), not every check
              </label>

              <label className="checkbox-row">
                <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
                Keep alerting every time this happens (recurring)
              </label>

              <button className="button button-primary" onClick={handleCreate} disabled={loading}>
                Create trigger
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
