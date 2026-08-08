import { OAuth2Client } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  const oauth2Client = new OAuth2Client(
    process.env.GMB_CLIENT_ID,
    process.env.GMB_CLIENT_SECRET,
    "https://turfit.vercel.app/api/google/gmb-oauth-callback"
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      throw new Error("Refresh token not received. Please re-authorize.");
    }

    oauth2Client.setCredentials({
      refresh_token: tokens.refresh_token
    });

    const { token: accessToken } =
      await oauth2Client.getAccessToken();

    if (!accessToken) {
      throw new Error("Could not get Google access token.");
    }

    // 1. Get Google Business Profile accounts
    const accountsResponse = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const accountsData = await accountsResponse.json();

    if (!accountsResponse.ok) {
      throw new Error(
        accountsData.error?.message || "Could not fetch GBP accounts"
      );
    }

    if (!accountsData.accounts?.length) {
      throw new Error("No Google Business Profile accounts found.");
    }

    // 2. Find locations
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
        "No Google Business Profile location found for this account."
      );
    }

    console.log("GMB LOCATION FOUND:", location.name);
    console.log("GMB LOCATION TITLE:", location.title);

    // 3. Save everything
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { error } = await supabase
      .from("gmb_auth")
      .upsert({
        id: 1,
        refresh_token: tokens.refresh_token,
        location_id: location.name,
        location_title: location.title || null,
        updated_at: new Date()
      });

    if (error) {
      throw error;
    }

    res.redirect(
      302,
      `/admin.html?gmb_status=success&location=${encodeURIComponent(
        location.name
      )}`
    );

  } catch (error) {
    console.error("GMB OAuth error:", error);

    res.redirect(
      302,
      `/admin.html?gmb_status=error&message=${encodeURIComponent(
        error.message
      )}`
    );
  }
}