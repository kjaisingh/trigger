import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { disablePush, enablePush, getPushSubscription, isPushSupported } from '../lib/push.js';

export default function Settings() {
  const { signInWithGoogle } = useAuth();
  const [pushSupported, setPushSupported] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    isPushSupported().then(setPushSupported);
    getPushSubscription().then((sub) => setPushEnabled(Boolean(sub)));
    api.get('/api/settings').then((data) => setGmailConnected(data.gmail_connected));
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

  async function disconnectGmail() {
    await api.delete('/api/settings/gmail-connect');
    setGmailConnected(false);
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

      <div className="card stack">
        <h3>Gmail</h3>
        <div className="row row-between">
          <span>{gmailConnected ? 'Connected' : 'Not connected'}</span>
          {gmailConnected ? (
            <button className="button button-danger" onClick={disconnectGmail}>
              Disconnect
            </button>
          ) : (
            <button className="button button-primary" onClick={signInWithGoogle}>
              Connect Gmail
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
