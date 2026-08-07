async function getAccessToken(clientId, clientSecret, refreshToken) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${data.error_description || response.statusText}`);
  }
  return data.access_token;
}

export default async function handler(req, res) {
  try {
    if (!process.env.GOOGLE_REFRESH_TOKEN) {
      return res.status(500).json({ error: "Google Refresh Token is not configured." });
    }

    // Get fresh access token
    const accessToken = await getAccessToken(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REFRESH_TOKEN
    );

    // Get accounts
    const accountsRes = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const accounts = await accountsRes.json();

    if (!accountsRes.ok) {
      return res.status(accountsRes.status).json({ error: "Failed to fetch GMB accounts", details: accounts });
    }

    return res.status(200).json(accounts);
  } catch (err) {
    console.error("Error in /api/google-business:", err);
    return res.status(500).json({
      error: err.message,
    });
  }
}