// File: api/get-public-key.js
export default function handler(req, res) {
  // These variables must be set in your Vercel Project Settings
  res.status(200).json({
    SUPABASE_URL_PUBLIC: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });
}