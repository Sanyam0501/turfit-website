// api/delete-booking.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // 1. Only allow DELETE requests
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

    const { id } = req.query;
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

    // 2. Check if environment variables exist
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Server configuration missing' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 3. Perform the delete
    const { error } = await supabase
        .from('turf_bookings')
        .delete()
        .eq('id', id);

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Deleted successfully' });
}