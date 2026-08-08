// /api/gmb-data.js
import { OAuth2Client } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Securely connect to Supabase from the backend
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  // 1. Get refresh token from database
  const { data: authData, error: authError } = await supabase
    .from('gmb_auth')
    .select('refresh_token')
    .eq('id', 1)
    .single();

  if (authError || !authData || !authData.refresh_token) {
    return res.status(401).json({ error: 'Not authenticated with Google. Please connect your account.' });
  }

  // 2. Use refresh token to get a new access token
  const oauth2Client = new OAuth2Client(
    process.env.GMB_CLIENT_ID,
    process.env.GMB_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: authData.refresh_token });
  const { token: accessToken } = await oauth2Client.getAccessToken();

  // 3. Fetch data from GMB Performance API
  try {
    // IMPORTANT: Replace YOUR_LOCATION_ID with your actual GMB location ID.
    // It looks like 'locations/12345678901234567890'.
    // You can find it in the URL of your GMB dashboard.
    const locationId = 'locations/YOUR_LOCATION_ID'; 
    const apiUrl = `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries`;

    // Get dates for the last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer `,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dailyMetric: 'SEARCH_IMPRESSIONS',
        dailyRange: {
          startDate: { year: startDate.getFullYear(), month: startDate.getMonth() + 1, day: startDate.getDate() },
          endDate: { year: endDate.getFullYear(), month: endDate.getMonth() + 1, day: endDate.getDate() },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google API Error: ${errorData.error.message}`);
    }

    const gmbData = await response.json();
    
    // Sum up the impressions from the time series
    const totalImpressions = gmbData.timeSeries.points.reduce((sum, point) => sum + parseInt(point.value, 10), 0);

    res.status(200).json({ impressions: totalImpressions });

  } catch (error) {
    console.error('Error fetching GMB data:', error);
    res.status(500).json({ error: error.message });
  }
}
