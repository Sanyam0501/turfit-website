import { OAuth2Client } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Get saved Google credentials
    const { data: authData, error: authError } = await supabase
      .from("gmb_auth")
      .select("refresh_token, location_id")
      .eq("id", 1)
      .single();

    if (
      authError ||
      !authData?.refresh_token ||
      !authData?.location_id
    ) {
      return res.status(401).json({
        error: "Google Business Profile is not connected."
      });
    }

    // Get fresh access token
    const oauth2Client = new OAuth2Client(
      process.env.GMB_CLIENT_ID,
      process.env.GMB_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: authData.refresh_token
    });

    const { token: accessToken } =
      await oauth2Client.getAccessToken();

    if (!accessToken) {
      throw new Error("Could not refresh Google access token.");
    }

    const locationId = authData.location_id;

    // Last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    const params = new URLSearchParams({
      dailyMetric: "BUSINESS_IMPRESSIONS_MOBILE_SEARCH"
    });

    params.append(
      "dailyRange.startDate.year",
      startDate.getFullYear()
    );
    params.append(
      "dailyRange.startDate.month",
      startDate.getMonth() + 1
    );
    params.append(
      "dailyRange.startDate.day",
      startDate.getDate()
    );

    params.append(
      "dailyRange.endDate.year",
      endDate.getFullYear()
    );
    params.append(
      "dailyRange.endDate.month",
      endDate.getMonth() + 1
    );
    params.append(
      "dailyRange.endDate.day",
      endDate.getDate()
    );

    const apiUrl =
      `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries?${params.toString()}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const gmbData = await response.json();

    if (!response.ok) {
      throw new Error(
        gmbData.error?.message || "Google Business Profile API error"
      );
    }

    const points =
      gmbData.timeSeries?.points || [];

    const totalImpressions = points.reduce(
      (sum, point) =>
        sum + Number(point.value || 0),
      0
    );

    return res.status(200).json({
      impressions: totalImpressions,
      location: locationId
    });

  } catch (error) {
    console.error("GMB data error:", error);

    return res.status(500).json({
      error: error.message
    });
  }
}