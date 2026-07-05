import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

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

    const { data, error } = await supabase
      .from("turf_bookings")
      .select(
        "customer_name, booking_date, price, paid_cash, paid_upi"
      )
      .order("booking_date", { ascending: true });

    if (error) throw error;

    const pendingBookings = [];

    let totalPending = 0;

    for (const booking of data) {
      const cash = Number(booking.paid_cash || 0);
      const upi = Number(booking.paid_upi || 0);
      const pending = Number(booking.price) - cash - upi;

      if (pending > 0) {
        totalPending += pending;

        pendingBookings.push({
          customer: booking.customer_name,
          date: booking.booking_date,
          pending,
        });
      }
    }

    let html = `
      <h2>TURFIT Pending Payment Report</h2>
      <p>Date: ${new Date().toLocaleDateString("en-IN")}</p>
      <hr />
    `;

    if (pendingBookings.length === 0) {
      html += `<p><strong>✅ No pending payments.</strong></p>`;
    } else {
      html += `
      <table border="1" cellspacing="0" cellpadding="8" style="border-collapse:collapse;">
        <tr>
          <th>Customer</th>
          <th>Booking Date</th>
          <th>Pending</th>
        </tr>
      `;

      pendingBookings.forEach((b) => {
        html += `
        <tr>
          <td>${b.customer}</td>
          <td>${b.date}</td>
          <td>₹${b.pending}</td>
        </tr>
        `;
      });

      html += `
      </table>

      <br>

      <h3>Total Pending : ₹${totalPending}</h3>
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
      subject: `TURFIT Pending Payment Report - ${new Date().toLocaleDateString(
        "en-IN"
      )}`,
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