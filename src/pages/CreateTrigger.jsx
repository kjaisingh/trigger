import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import {
  METRIC_LABELS,
  METRICS_BY_DOMAIN,
  OPERATOR_LABELS,
  OPERATORS,
} from '../../shared/domains.js';
import { describeSubject, describeCondition } from '../lib/summarize.js';

export default function CreateTrigger() {
  useDocumentTitle('New trigger');
  const navigate = useNavigate();
  const [rawPrompt, setRawPrompt] = useState('');
  const [parsed, setParsed] = useState(null);
  const [recurring, setRecurring] = useState(false);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const promptVersion = useRef(0);

  async function handleParse(e) {
    e.preventDefault();
    const version = promptVersion.current;
    setError('');
    setPending('parse');
    try {
      const result = await api.post('/api/triggers/parse', { raw_prompt: rawPrompt });
      if (version === promptVersion.current) setParsed(result);
    } catch (err) {
      if (version === promptVersion.current) setError(err.message);
    } finally {
      setPending(null);
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
      condition: {
        metric: METRICS_BY_DOMAIN[domain]?.[0],
        operator: '>',
        threshold: '',
        edge_trigger: false,
      },
      unsupported_reason: null,
    });
  }

  async function handleCreate() {
    const threshold = Number(parsed.condition.threshold);
    if (
      parsed.domain !== 'unsupported' &&
      (parsed.condition.threshold === '' || !Number.isFinite(threshold))
    ) {
      setError('Enter a valid threshold.');
      return;
    }
    setError('');
    setPending('create');
    try {
      await api.post('/api/triggers', {
        raw_prompt: rawPrompt,
        ...parsed,
        condition:
          parsed.domain === 'unsupported' ? parsed.condition : { ...parsed.condition, threshold },
        recurring,
        channels: ['push'],
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="stack create-trigger">
      <h2>New trigger</h2>

      <form onSubmit={handleParse} className="stack">
        <label htmlFor="trigger-prompt">What should Trigger watch?</label>
        <textarea
          id="trigger-prompt"
          placeholder="e.g. Let me know when it stops raining in Boston"
          value={rawPrompt}
          onChange={(e) => {
            promptVersion.current += 1;
            setRawPrompt(e.target.value);
            setParsed(null);
          }}
          rows={3}
          maxLength={500}
          required
        />
        <p className="muted">
          Conditions are checked every 15 minutes. Alerts may arrive later than the event.
        </p>
        <button
          type="submit"
          className="button button-primary"
          disabled={pending !== null || !rawPrompt.trim()}
        >
          {pending === 'parse' ? 'Interpreting...' : 'Continue'}
        </button>
      </form>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      {parsed && (
        <div className="card confirm-card stack">
          <div className="row">
            <label>Domain</label>
            <select
              aria-label="Domain"
              value={parsed.domain}
              onChange={(e) => changeDomain(e.target.value)}
            >
              <option value="weather">Weather</option>
              <option value="sports">Sports</option>
              <option value="crypto">Crypto</option>
              <option value="unsupported">Unsupported</option>
            </select>
          </div>

          {parsed.domain === 'unsupported' ? (
            <p className="error-text">
              {parsed.unsupported_reason || "This request isn't supported yet."}
            </p>
          ) : (
            <>
              <div className="row">
                <span className="label">Watching</span>
                <span>{describeSubject(parsed.domain, parsed.subject)}</span>
              </div>
              <div className="row">
                <span className="label">Fires when</span>
                <span>
                  {parsed.condition.threshold === ''
                    ? 'Enter a threshold below.'
                    : describeCondition(parsed.condition)}
                </span>
              </div>

              {parsed.domain === 'weather' && (
                <input
                  aria-label="Location"
                  placeholder="Location"
                  value={parsed.subject.location || ''}
                  onChange={(e) => updateSubjectField('location', e.target.value)}
                />
              )}

              {parsed.domain === 'sports' && (
                <>
                  <input
                    aria-label="Team"
                    placeholder="Team"
                    value={parsed.subject.team || ''}
                    onChange={(e) => updateSubjectField('team', e.target.value)}
                  />
                  <input
                    aria-label="Opponent (optional)"
                    placeholder="Opponent (optional)"
                    value={parsed.subject.opponent || ''}
                    onChange={(e) => updateSubjectField('opponent', e.target.value)}
                  />
                </>
              )}

              {parsed.domain === 'crypto' && (
                <input
                  aria-label="Coin id"
                  placeholder="Coin id (e.g. bitcoin)"
                  value={parsed.subject.coin_id || ''}
                  onChange={(e) => updateSubjectField('coin_id', e.target.value)}
                />
              )}

              <div className="row condition-row">
                <select
                  aria-label="Metric"
                  value={parsed.condition.metric}
                  onChange={(e) => updateConditionField('metric', e.target.value)}
                >
                  {METRICS_BY_DOMAIN[parsed.domain]?.map((metric) => (
                    <option key={metric} value={metric}>
                      {METRIC_LABELS[metric] || metric}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Comparison"
                  value={parsed.condition.operator}
                  onChange={(e) => updateConditionField('operator', e.target.value)}
                >
                  {OPERATORS.map((op) => (
                    <option key={op} value={op}>
                      {OPERATOR_LABELS[op] || op}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Threshold"
                  type="number"
                  step="any"
                  value={parsed.condition.threshold}
                  onChange={(e) => {
                    updateConditionField('threshold', e.target.value);
                  }}
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
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                />
                Keep alerting every time this happens (recurring)
              </label>
            </>
          )}

          <button
            type="button"
            className="button button-primary"
            onClick={handleCreate}
            disabled={
              pending !== null ||
              (parsed.domain !== 'unsupported' &&
                (parsed.condition.threshold === '' ||
                  !Number.isFinite(Number(parsed.condition.threshold))))
            }
          >
            {pending === 'create'
              ? 'Creating...'
              : parsed.domain === 'unsupported'
                ? 'Save anyway'
                : 'Create trigger'}
          </button>
        </div>
      )}
    </div>
  );
}
