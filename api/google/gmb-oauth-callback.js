import { OAuth2Client } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const { code, error: oauthError } = req.query;

  if (oauthError) {
    return res.status(400).send(`
      <h2>Google OAuth Error</h2>
      <p>${oauthError}</p>
    `);
  }

  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  const redirectUri =
    "https://turfit.vercel.app/api/google/gmb-oauth-callback";

  const oauth2Client = new OAuth2Client(
    process.env.GMB_CLIENT_ID,
    process.env.GMB_CLIENT_SECRET,
    redirectUri
  );

  try {
    // 1. Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    console.log("GOOGLE TOKENS RECEIVED:", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      scope: tokens.scope
    });

    if (!tokens.refresh_token) {
      throw new Error(
        "Google did not return a refresh token. Revoke the existing app access from your Google Account and authorize again."
      );
    }

    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token
    });

    // 2. Get a fresh access token
    const { token: accessToken } =
      await oauth2Client.getAccessToken();

    if (!accessToken) {
      throw new Error("Could not obtain Google access token.");
    }

    // 3. Get GBP accounts
    const accountsResponse = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const accountsData = await accountsResponse.json();

    console.log("GBP ACCOUNTS RESPONSE:", accountsData);

    if (!accountsResponse.ok) {
      throw new Error(
        accountsData.error?.message ||
        "Could not fetch Google Business Profile accounts"
      );
    }

    if (!accountsData.accounts?.length) {
      throw new Error(
        "No Google Business Profile accounts found. Make sure this Google account manages your business profile."
      );
    }

    // 4. Find a location
    let location = null;

    for (const account of accountsData.accounts) {
      const locationsUrl =
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations` +
        `?readMask=name,title,storeCode&pageSize=100`;

      const locationsResponse = await fetch(locationsUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      const locationsData = await locationsResponse.json();

      console.log(
        "LOCATIONS RESPONSE:",
        account.name,
        locationsData
      );

      if (!locationsResponse.ok) {
        continue;
      }

      if (locationsData.locations?.length) {
        location = locationsData.locations[0];
        break;
      }
    }

    if (!location) {
      throw new Error(
        "Google authorization succeeded, but no Google Business Profile location was found for this account."
      );
    }

    console.log("GBP LOCATION FOUND:", location);

    // 5. Connect to Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // 6. Save credentials
    const { data, error: dbError } = await supabase
      .from("gmb_auth")
      .upsert(
        {
          id: 1,
          refresh_token: tokens.refresh_token,
          location_id: location.name,
          location_title: location.title || null,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: "id"
        }
      )
      .select();

    if (dbError) {
      console.error("SUPABASE GMB ERROR:", dbError);
      throw new Error(
        `Supabase error: ${dbError.message}`
      );
    }

    console.log("GMB AUTH SAVED:", data);

    // 7. Success
    return res.status(200).send(`
      <html>
        <body style="font-family: Arial; padding: 40px;">
          <h2>Google Business Profile Connected ✅</h2>
          <p>Location: ${location.title || "Business Profile"}</p>
          <p>Location ID: ${location.name}</p>
          <p>The connection has been saved successfully.</p>
          <br>
          <a href="/admin.html">Return to TURFIT</a>
        </body>
      </html>
    `);

  } catch (error) {
    console.error("GMB OAUTH CALLBACK ERROR:", error);

    return res.status(500).send(`
      <html>
        <body style="font-family: Arial; padding: 40px;">
          <h2>Google Business Profile Connection Failed ❌</h2>
          <p><strong>Error:</strong></p>
          <pre style="background:#f5f5f5;padding:20px;border-radius:8px;">
${String(error.message)}
          </pre>
          <br>
          <a href="/admin.html">Return to TURFIT</a>
        </body>
      </html>
    `);
  }
}