export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code missing.");
  }

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

  const data = await tokenRes.json();

  res.setHeader("Content-Type", "application/json");
  res.status(200).send(JSON.stringify(data, null, 2));
}