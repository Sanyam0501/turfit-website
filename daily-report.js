import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export default async function handler(req, res) {
  // 1. Secure the endpoint
  if (
    !process.env.CRON_SECRET ||
    req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Initialize clients
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY // Use the service key for backend operations
  );
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    // 3. Calculate today's date (since the report runs at the end of the day)
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    // 4. Fetch pending bookings from the current day
    const { data: pendingBookings, error } = await supabase
      .from('turf_bookings')
      .select('customer_name, phone_number, price, paid_amount, start_time')
      .eq('booking_date', todayString)
      .gt('price', 'paid_amount');

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    // 5. Generate the report content
    let totalPending = 0;
    const bookingsList = pendingBookings.map(b => {
      const pending = b.price - b.paid_amount;
      totalPending += pending;
      const startTime12H = new Date(`1970-01-01T${b.start_time}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      return `<li><strong>${b.customer_name}</strong> (${startTime12H}): ₹${pending} pending</li>`;
    }).join('');

    const reportDate = today.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const subject = `Turfit Daily Report: ₹${totalPending} Pending for ${reportDate}`;

    const htmlBody = `
      <h1>Turfit Daily Pending Report</h1>
      <p><strong>Date:</strong> ${reportDate}</p>
      <hr>
      <h2>Total Pending: ₹${totalPending.toLocaleString()}</h2>
      ${pendingBookings.length > 0 ? `
      <h3>Details:</h3>
      <ul>
        ${bookingsList}
      </ul>
      ` : '<p>No pending payments for today. Great job!</p>'}
      <hr>
      <p><em>This is an automated report.</em></p>
    `;

    // 6. Send the email
    await resend.emails.send({
      from: 'Turfit Report <report@your-verified-domain.com>', // IMPORTANT: Replace with your verified Resend domain
      to: process.env.ADMIN_EMAIL,
      subject: subject,
      html: htmlBody,
    });

    return res.status(200).json({ success: true, message: 'Report sent.' });

  } catch (e) {
    console.error('Cron job failed:', e);
    // Optionally send an error email
    return res.status(500).json({ error: 'Server error while sending report.' });
  }
}