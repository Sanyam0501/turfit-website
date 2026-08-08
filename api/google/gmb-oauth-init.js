import { OAuth2Client } from "google-auth-library";

export default function handler(req, res) {
  const oauth2Client = new OAuth2Client(
    process.env.GMB_CLIENT_ID,
    process.env.GMB_CLIENT_SECRET,
    "https://turfit.vercel.app/api/gmb-oauth-callback"
  );

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/business.manage"
    ],
    prompt: "consent"
  });

  res.redirect(302, authorizationUrl);
}