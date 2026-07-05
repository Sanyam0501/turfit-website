import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

function formatTo12H(timeStr) {
  if (!timeStr) return "";
  let [h, m] = timeStr.split(":");
  h = parseInt(h);
  return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
}

export default async function handler(req, res) {
  // Allow only Vercel Cron
  // if (
  //   process.env.CRON_SECRET &&
  //   req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  // ) {
  //   return res.status(401).json({ error: "Unauthorized access not granted" });
  // }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayISO = yesterday.toISOString().split("T")[0]; // YYYY-MM-DD

    const { data, error } = await supabase
      .from("turf_bookings")
      .select("customer_name, booking_date, start_time, price, paid_cash, paid_upi")
      .lte("booking_date", yesterdayISO) // Only fetch bookings up to yesterday
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: false });

    if (error) throw error;

    const pendingBookings = [];
    let totalPending = 0;

    for (const booking of data) {
      // Skip if booking date is after yesterday (double-check, though DB should handle it)
      const bookingDate = new Date(booking.booking_date);
      bookingDate.setHours(0, 0, 0, 0);

      const yesterdayDate = new Date(yesterday);
      yesterdayDate.setHours(0, 0, 0, 0);

      if (bookingDate > yesterdayDate) continue;

      const cash = Number(booking.paid_cash || 0);
      const upi = Number(booking.paid_upi || 0);
      const pending = Number(booking.price) - cash - upi;

      if (pending > 0) {
        totalPending += pending;

        pendingBookings.push({
          customer: booking.customer_name,
          date: booking.booking_date,
          time: booking.start_time,
          pending,
        });
      }
    }

    const todayFormatted = today.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const yesterdayFormatted = yesterday.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    let html;

    if (pendingBookings.length === 0) {
      html = `
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f9f9f9;">
          <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #1b4332; border-bottom: 2px solid #eee; padding-bottom: 10px;">Pending Payments Report</h2>
            <p style="font-size: 16px; color: #555;">As of ${yesterdayFormatted}</p>
            <p style="font-size: 16px; color: #28a745; font-weight: bold;">✅ No pending payments found.</p>
          </div>
        </body>
      `;
    } else {
      const tableRows = pendingBookings
        .map(
          (b) => {
            const bookingDate = new Date(b.date).toLocaleDateString("en-GB", { day: '2-digit', month: 'short' });
            const bookingTime = formatTo12H(b.time);
            return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${b.customer}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; white-space: nowrap;">${bookingDate} - ${bookingTime}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">₹${b.pending.toLocaleString()}</td>
        </tr>
      `
          }
        )
        .join("");

      html = `
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f9f9f9;">
          <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #1b4332; border-bottom: 2px solid #eee; padding-bottom: 10px;">Pending Payments Report</h2>
            <p style="font-size: 16px; color: #555;">As of ${yesterdayFormatted}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
              <thead>
                <tr>
                  <th style="text-align: left; padding: 12px; background-color: #f2f2f2; border-bottom: 1px solid #ddd; width: 40%;">Customer</th>
                  <th style="text-align: left; padding: 12px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Booking</th>
                  <th style="text-align: right; padding: 12px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Pending</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
              <tfoot>
                <tr style="font-weight: bold;">
                  <td colspan="2" style="padding: 12px; border-top: 2px solid #333;">Total Pending</td>
                  <td style="padding: 12px; border-top: 2px solid #333; text-align: right; color: #d9534f;">₹${totalPending.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </body>
      `;
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `TURFIT Pending Payments till - ${yesterdayFormatted}`,
      html,
    });

    return res.status(200).json({
      success: true,
      sent: pendingBookings.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message,
    });
  }
}