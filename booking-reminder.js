import { createClient } from "@supabase/supabase-js";

function formatTo12H(timeStr) {
  if (!timeStr) return "";
  let [h, m] = timeStr.split(":");
  h = parseInt(h);
  return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
}

export default async function handler(req, res) {
  // 1. Authenticate the cron job request
  if (
    process.env.CRON_SECRET &&
    req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // 2. Define the time window for reminders (24 to 25 hours from now)
    const now = new Date();
    const reminderWindowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const reminderWindowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // 3. Find bookings that need a reminder
    const { data: bookings, error: fetchError } = await supabase
      .from("turf_bookings")
      .select("id, customer_name, phone_number, booking_date, start_time")
      .is("reminder_sent_at", null) // Reminder has not been sent yet
      .gte("booking_date", now.toISOString().split("T")[0]) // Optimization: only look from today onwards
      .limit(50); // Process up to 50 reminders per run to be safe

    if (fetchError) throw fetchError;

    const remindersToSend = bookings.filter(b => {
        const bookingDateTime = new Date(`${b.booking_date}T${b.start_time}`);
        return bookingDateTime >= reminderWindowStart && bookingDateTime < reminderWindowEnd;
    });

    if (remindersToSend.length === 0) {
      return res.status(200).json({ success: true, message: "No reminders to send." });
    }

    let sentCount = 0;
    const updatePromises = [];

    // 4. Process each booking
    for (const booking of remindersToSend) {
      const phoneNumber = "91" + booking.phone_number.replace(/\D/g, "");
      const bookingDate = new Date(booking.booking_date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      const startTime12H = formatTo12H(booking.start_time);

      const message =
        `*BOOKING REMINDER - TURFIT*\n\n` +
        `Hi *${booking.customer_name}*,\n\n` +
        `This is a friendly reminder for your upcoming booking with TURFIT:\n\n` +
        `*Date:* ${bookingDate}\n` +
        `*Time:* ${startTime12H}\n\n` +
        `*Location:* https://maps.app.goo.gl/xi1efYzFSVFyzJph6\n\n` +
        `We look forward to seeing you!`;

      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
      
      // In a serverless environment, we can't open a browser.
      // We log the action. For full automation, a WhatsApp Business API is needed.
      console.log(`Reminder for ${booking.customer_name}: ${whatsappUrl}`);

      // 5. Mark the reminder as sent
      updatePromises.push(
        supabase
          .from("turf_bookings")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", booking.id)
      );
      sentCount++;
    }

    await Promise.all(updatePromises);

    return res.status(200).json({ success: true, sent: sentCount });

  } catch (err) {
    console.error("Error in booking-reminder cron:", err);
    return res.status(500).json({ error: err.message });
  }
}