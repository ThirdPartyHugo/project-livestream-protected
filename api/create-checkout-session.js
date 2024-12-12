import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';



// Supabase initialization
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PRIVATE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15',
});

// Retrieve the current global count from Supabase
const getGlobalSuccessCount = async () => {
  const { data, error } = await supabase
    .from('global_counts')
    .select('count')
    .eq('id', 1)
    .single();

  if (error) {
    console.error('Error fetching global success count:', error.message);
    return 0;
  }

  return data ? data.count : 0;
};

// Update the global count in Supabase
const setGlobalSuccessCount = async (value) => {
  const { error } = await supabase
    .from('global_counts')
    .upsert({ id: 1, count: value });

  if (error) {
    console.error('Error updating global success count:', error.message);
  }
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { name, email, amount } = req.body;

    if (!name || !email || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid data' });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'cad',
              product_data: { name },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `https://www.workenligne.com/api/create-checkout-session?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `https://www.workenligne.com/`,
        customer_email: email,
        metadata: { name }, // Pass metadata for client name
      });

      return res.status(200).json({ id: session.id });
    } catch (error) {
      console.error('Error creating Stripe session:', error.message);
      return res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }

  if (req.method === 'GET' && req.query.session_id) {
    const { session_id } = req.query;

    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.payment_status === 'paid') {
        // Increment the global success count
        const currentCount = await getGlobalSuccessCount();
        await setGlobalSuccessCount(currentCount + 1);

        // Update client data in Supabase
        const { customer_email: email } = session;

        const { error: updateError } = await supabase
          .from('clients')
          .update({ paid: true })
          .eq('email', email);

        if (updateError) {
          console.error('Error updating client data:', updateError.message);
        }

        // Redirect the user after 500ms
        const defaultUrl = "https://www.workenligne.com/";
        return res.status(200).send(`
          <html>
            <head>
              <title>Payment Successful</title>
              <meta http-equiv="refresh" content="0.5;url=${defaultUrl}" />
              <script>
                setTimeout(() => {
                  window.location.href = "${defaultUrl}";
                }, 500);
              </script>
            </head>
            <body>
              <p>Payment successful! Redirecting...</p>
            </body>
          </html>
        `);
      } else {
        return res.status(400).send(`
          <html>
            <head>
              <title>Payment Not Completed</title>
            </head>
            <body>
              <p>Payment not completed. Please try again.</p>
            </body>
          </html>
        `);
      }
    } catch (error) {
      console.error('Error verifying session:', error.message);
      return res.status(500).send(`
        <html>
          <head>
            <title>Error</title>
          </head>
          <body>
            <p>Failed to verify payment session. Please contact support.</p>
          </body>
        </html>
      `);
    }
  }

  res.setHeader('Allow', ['POST', 'GET']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
