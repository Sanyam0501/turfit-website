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

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayISO = yesterday.toISOString().split("T")[0]; // YYYY-MM-DD

    const { data, error } = await supabase
      .from("turf_bookings")
      .select("customer_name, booking_date, price, paid_cash, paid_upi")
      .lte("booking_date", yesterdayISO) // Only fetch bookings up to yesterday
      .order("booking_date", { ascending: true });

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

    let textContent = `Pending Payments till ${yesterdayFormatted}\n\n`;

    if (pendingBookings.length === 0) {
      textContent += "✅ No pending payments found.\n";
    } else {
      const separator = "-".repeat(40) + "\n";
      textContent += "Customer".padEnd(25) + "Pending\n";
      textContent += separator;

      pendingBookings.forEach((b) => {
        const customerName =
          b.customer.length > 22 ? b.customer.substring(0, 22) + "…" : b.customer;
        textContent +=
          customerName.padEnd(25) + `₹${b.pending.toLocaleString()}\n`;
      });

      textContent += separator;
      textContent +=
        "Total Pending".padEnd(25) + `₹${totalPending.toLocaleString()}\n`;
    }

    // Use pre-formatted text in HTML for a consistent, clean look
    const html = `
    <div style="font-family:Courier New, monospace;white-space:pre-wrap;font-size:15px;">
    ${textContent}
    </div>
    `;

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
      subject: `Pending Payments till ${yesterdayFormatted}`,
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