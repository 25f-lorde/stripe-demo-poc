import Stripe from 'stripe';
import 'dotenv/config';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PLANS = [
  {
    name: 'Starter',
    description: '1 user, 5 GB storage, email support',
    monthlyPrice: 900, // in cents
    annualPrice: 9000,
  },
  {
    name: 'Pro',
    description: '5 users, 50 GB storage, priority support',
    monthlyPrice: 2900,
    annualPrice: 29000,
  },
  {
    name: 'Enterprise',
    description: 'Unlimited users, 500 GB storage, 24/7 support',
    monthlyPrice: 9900,
    annualPrice: 99000,
  },
];

async function seed() {
  console.log('Creating Stripe products and prices...\n');

  for (const plan of PLANS) {
    // Create product
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
    });
    console.log(`Created product: ${product.name} (${product.id})`);

    // Create monthly price
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.monthlyPrice,
      currency: 'usd',
      recurring: { interval: 'month' },
      lookup_key: `${plan.name.toLowerCase()}_monthly`,
    });
    console.log(`  Monthly: $${plan.monthlyPrice / 100}/mo (${monthlyPrice.id}) [lookup: ${monthlyPrice.lookup_key}]`);

    // Create annual price
    const annualPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.annualPrice,
      currency: 'usd',
      recurring: { interval: 'year' },
      lookup_key: `${plan.name.toLowerCase()}_annual`,
    });
    console.log(`  Annual:  $${plan.annualPrice / 100}/yr (${annualPrice.id}) [lookup: ${annualPrice.lookup_key}]`);

    console.log('');
  }

  console.log('Done! Now update your pricing page to use these price IDs.');
  console.log('Or use lookup keys — they are already set.');
}

seed().catch(console.error);
