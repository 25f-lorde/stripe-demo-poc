import Stripe from 'stripe';
import 'dotenv/config';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function setupPortal() {
  // Get all active products
  const products = await stripe.products.list({ active: true });
  console.log(`Found ${products.data.length} products\n`);

  // Get all prices and group by product
  const prices = await stripe.prices.list({ active: true, type: 'recurring', expand: ['data.product'] });

  const productConfigs: Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate.Product[] = [];

  for (const product of products.data) {
    const productPrices = prices.data.filter((p) => {
      const prodId = typeof p.product === 'string' ? p.product : p.product.id;
      return prodId === product.id;
    });

    if (productPrices.length > 0) {
      productConfigs.push({
        product: product.id,
        prices: productPrices.map((p) => p.id),
      });
      console.log(`${product.name}:`);
      productPrices.forEach((p) => {
        console.log(`  ${p.lookup_key ?? p.id} — $${(p.unit_amount ?? 0) / 100}/${p.recurring?.interval}`);
      });
    }
  }

  console.log('\nCreating Customer Portal configuration...');

  const config = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: 'Manage your BillFlow subscription',
    },
    features: {
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price', 'promotion_code'],
        proration_behavior: 'create_prorations',
        products: productConfigs,
      },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: {
          enabled: true,
          options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'],
        },
      },
      payment_method_update: {
        enabled: true,
      },
      invoice_history: {
        enabled: true,
      },
    },
  });

  console.log(`\nPortal configured! ID: ${config.id}`);
  console.log('Features enabled:');
  console.log('  - Switch between plans (all 3 tiers, monthly + annual)');
  console.log('  - Cancel subscription (at period end)');
  console.log('  - Update payment method');
  console.log('  - View invoice history');
}

setupPortal().catch(console.error);
