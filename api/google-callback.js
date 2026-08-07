export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).json({ error: "OAuth error", details: error });
  }

  if (!code) {
    return res.status(400).json({ error: "Authorization code not found." });
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({ error: "Failed to fetch token", details: tokenData });
    }

    // IMPORTANT: Securely store the tokenData.refresh_token
    // For this example, we'll just log it. In production, save it to a secure database or environment variable.
    console.log("Received Refresh Token:", tokenData.refresh_token);
    
    // Provide a more user-friendly response in the browser.
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
      <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
        <h1>Authentication Successful!</h1>
        <p>You can now close this tab. The Refresh Token has been printed in your server console.</p>
      </body>
    `);
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
}