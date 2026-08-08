// /api/gmb-oauth-callback.js
import { OAuth2Client } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { code } = req.query;

  const oauth2Client = new OAuth2Client(
    process.env.GMB_CLIENT_ID,
    process.env.GMB_CLIENT_SECRET,
    '<https://your-turfit-website.com/api/gmb-oauth-callback>'
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      throw new Error('Refresh token not received. Please re-authenticate.');
    }

    // Securely connect to Supabase from the backend
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Store the refresh token
    const { error } = await supabase
      .from('gmb_auth')
      .upsert({ id: 1, refresh_token: refreshToken, updated_at: new Date() });

    if (error) {
      throw error;
    }

    // Redirect back to the admin dashboard
    res.redirect(302, '/admin.html?gmb_status=success');

  } catch (error) {
    console.error('Error during OAuth callback:', error);
    res.redirect(302, `/admin.html?gmb_status=error&message=${encodeURIComponent(error.message)}`);
  }
}
