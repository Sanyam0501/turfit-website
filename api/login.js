const loginAttempts = {};
const MAX_ATTEMPTS = 3;
const LOCKOUT_TIME = 2 * 60 * 1000; // 2 minutes

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Check if IP is currently locked out
  if (loginAttempts[ip] && loginAttempts[ip].count >= MAX_ATTEMPTS) {
    const timeSinceLastAttempt = Date.now() - loginAttempts[ip].timestamp;
    if (timeSinceLastAttempt < LOCKOUT_TIME) {
      const timeLeft = Math.ceil((LOCKOUT_TIME - timeSinceLastAttempt) / 1000 / 60);
      return res.status(429).json({ 
        error: `Too many failed attempts. Please try again in ${timeLeft} minutes.` 
      });
    } else {
      // If lockout time has passed, reset the counter
      delete loginAttempts[ip];
    }
  }

  try {
    // Parse body if it's a string, otherwise use it directly
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { pin } = body;
    
    if (pin === process.env.ADMIN_PIN) {
      // On success, clear any previous failed attempts for this IP
      if (loginAttempts[ip]) {
        delete loginAttempts[ip];
      }
      const token = 'session_' + Math.random().toString(36).substr(2) + Date.now();
      return res.status(200).json({ token });
    }

    // On failure, add a small delay to slow down brute-force attacks
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Record the failed attempt
    if (!loginAttempts[ip]) {
      loginAttempts[ip] = { count: 0, timestamp: 0 };
    }
    loginAttempts[ip].count++;
    loginAttempts[ip].timestamp = Date.now();

    return res.status(401).json({ error: 'Invalid PIN' });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
}