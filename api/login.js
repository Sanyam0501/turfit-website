export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse body if it's a string, otherwise use it directly
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { pin } = body;
    
    if (pin === process.env.ADMIN_PIN) {
      const token = 'session_' + Math.random().toString(36).substr(2) + Date.now();
      return res.status(200).json({ token });
    }

    return res.status(401).json({ error: 'Invalid PIN' });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
}