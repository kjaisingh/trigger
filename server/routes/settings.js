import { Router } from 'express';
import { supabase, unwrap } from '../lib/db.js';
import { encrypt } from '../lib/crypto.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const settings = unwrap(
      await supabase
        .from('user_settings')
        .select('gmail_oauth_refresh_token_encrypted')
        .eq('user_id', req.user.id)
        .maybeSingle(),
    );

    res.json({ gmail_connected: Boolean(settings?.gmail_oauth_refresh_token_encrypted) });
  } catch (error) {
    next(error);
  }
});

router.post('/gmail-connect', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ message: 'refresh_token is required.' });
    }

    unwrap(
      await supabase.from('user_settings').upsert({
        user_id: req.user.id,
        gmail_oauth_refresh_token_encrypted: encrypt(refresh_token),
        updated_at: new Date().toISOString(),
      }),
    );

    res.json({ gmail_connected: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/gmail-connect', async (req, res, next) => {
  try {
    unwrap(
      await supabase.from('user_settings').upsert({
        user_id: req.user.id,
        gmail_oauth_refresh_token_encrypted: null,
        updated_at: new Date().toISOString(),
      }),
    );

    res.json({ gmail_connected: false });
  } catch (error) {
    next(error);
  }
});

export default router;
