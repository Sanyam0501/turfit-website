// /api/gmb-oauth-init.js
import { OAuth2Client } from 'google-auth-library';

export default function handler(req, res) {
  const oauth2Client = new OAuth2Client(
    process.env.GMB_CLIENT_ID,
    process.env.GMB_CLIENT_SECRET,
    '<https://your-turfit-website.com/api/gmb-oauth-callback>' // Must match your GCP settings
  );

  const scopes = [
    '<https://www.googleapis.com/auth/business.manage>' // Scope for GMB data
  ];

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Important to get a refresh token
    scope: scopes,
    prompt: 'consent' // Forces the consent screen to get a refresh token every time
  });

  res.redirect(302, authorizationUrl);
}
