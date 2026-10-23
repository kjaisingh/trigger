import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { disablePush, enablePush, getPushSubscription, isPushSupported } from '../lib/push.js';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

export default function Settings() {
  useDocumentTitle('Settings');
  const [pushSupported, setPushSupported] = useState(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const supported = await isPushSupported();
      if (!mounted) return;
      setPushSupported(supported);
      if (supported) {
        try {
          const subscription = await getPushSubscription();
          const status = subscription
            ? await api.post('/api/push/status', { endpoint: subscription.endpoint })
            : null;
          if (mounted) setPushEnabled(Boolean(status?.enabled));
        } catch (error) {
          if (mounted) {
            setPushEnabled(false);
            setMessage({
              error: true,
              text: error.message || "Couldn't check this device's subscription.",
            });
          }
        }
      }
      if (mounted) setChecking(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function togglePush() {
    setMessage(null);
    setPending(true);
    try {
      if (pushEnabled) {
        await disablePush();
        setPushEnabled(false);
      } else {
        await enablePush();
        setPushEnabled(true);
      }
    } catch (error) {
      if (pushEnabled) setPushEnabled(Boolean(await getPushSubscription().catch(() => null)));
      setMessage({
        error: true,
        text:
          error.name === 'NotAllowedError' || error.name === 'AbortError'
            ? 'Notifications are blocked for this site. Allow them in your browser settings and try again.'
            : error.message || "Couldn't update push notifications.",
      });
    } finally {
      setPending(false);
    }
  }

  async function sendTestPush() {
    setMessage(null);
    setPending(true);
    try {
      const subscription = await getPushSubscription();
      if (!subscription) throw new Error('Enable notifications on this device first.');
      await api.post('/api/push/test', { endpoint: subscription.endpoint });
      setMessage({ error: false, text: 'Test notification sent to this device.' });
    } catch (error) {
      setMessage({ error: true, text: error.message });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stack settings-page">
      <h2>Settings</h2>
      <div className="card stack">
        <h3>Push notifications</h3>
        <p className="muted">Get alerts on this device, even when Trigger is closed.</p>
        {checking || pushSupported === null ? (
          <p>Checking browser support...</p>
        ) : pushSupported ? (
          <>
            <div className="row row-between">
              <span>{pushEnabled ? 'Enabled on this device' : 'Not enabled on this device'}</span>
              <button type="button" className="button" onClick={togglePush} disabled={pending}>
                {pending ? 'Working...' : pushEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
            {pushEnabled && (
              <button type="button" className="button" onClick={sendTestPush} disabled={pending}>
                Send test notification
              </button>
            )}
          </>
        ) : (
          <p className="empty-state">
            Push needs a supported browser and HTTPS. On iPhone, add Trigger to your Home Screen
            first.
          </p>
        )}
        {message && (
          <p
            role={message.error ? 'alert' : 'status'}
            className={message.error ? 'error-text' : ''}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
