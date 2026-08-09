import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { disablePush, enablePush, getPushSubscription, isPushSupported } from '../lib/push.js';

export default function Settings() {
  const [pushSupported, setPushSupported] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    isPushSupported().then((supported) => {
      setPushSupported(supported);
      if (supported) {
        getPushSubscription().then((sub) => setPushEnabled(Boolean(sub)));
      }
    });
  }, []);

  async function togglePush() {
    if (pushEnabled) {
      await disablePush();
      setPushEnabled(false);
    } else {
      await enablePush();
      setPushEnabled(true);
    }
  }

  async function sendTestPush() {
    setMessage('');
    try {
      await api.post('/api/push/test', {});
      setMessage('Test notification sent.');
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="stack">
      <h2>Settings</h2>

      <div className="card stack">
        <h3>Push notifications</h3>
        {pushSupported ? (
          <>
            <div className="row row-between">
              <span>{pushEnabled ? 'Enabled on this device' : 'Not enabled on this device'}</span>
              <button className="button" onClick={togglePush}>
                {pushEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
            {pushEnabled && (
              <button className="button" onClick={sendTestPush}>
                Send test notification
              </button>
            )}
          </>
        ) : (
          <p className="empty-state">Push notifications aren't supported in this browser.</p>
        )}
        {message && <p>{message}</p>}
      </div>
    </div>
  );
}
