const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();

const COIN_PACKS = {
  starter: { coins: 500,   amount: 99,   label: "Starter Pack" },
  value:   { coins: 1500,  amount: 299,  label: "Value Pack" },
  pro:     { coins: 4000,  amount: 499,  label: "Pro Pack" },
  elite:   { coins: 10000, amount: 999,  label: "Elite Pack" },
};

// Creates a Stripe PaymentIntent and returns the client secret to the frontend
exports.createCoinPaymentIntent = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");

  const { packId } = request.data;
  const pack = COIN_PACKS[packId];
  if (!pack) throw new HttpsError("invalid-argument", "Invalid pack.");

  const stripe = Stripe(process.env.STRIPE_SECRET);

  const intent = await stripe.paymentIntents.create({
    amount: pack.amount,
    currency: "usd",
    metadata: {
      uid: request.auth.uid,
      packId,
      coins: pack.coins,
    },
  });

  return { clientSecret: intent.client_secret, packId, coins: pack.coins, amount: pack.amount };
});

// Called after payment succeeds on the frontend — credits coins to the user
exports.fulfillCoinPurchase = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");

  const { paymentIntentId, packId } = request.data;
  const pack = COIN_PACKS[packId];
  if (!pack) throw new HttpsError("invalid-argument", "Invalid pack.");

  const stripe = Stripe(process.env.STRIPE_SECRET);

  // Verify payment actually succeeded server-side
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.status !== "succeeded") throw new HttpsError("failed-precondition", "Payment not complete.");
  if (intent.metadata.uid !== request.auth.uid) throw new HttpsError("permission-denied", "UID mismatch.");

  // Idempotency — don't credit twice for the same payment
  const db = admin.firestore();
  const ledgerRef = db.collection("coinPurchases").doc(paymentIntentId);
  const existing = await ledgerRef.get();
  if (existing.exists) return { coins: pack.coins, alreadyCredited: true };

  // Credit coins atomically
  await db.runTransaction(async (tx) => {
    const userRef = db.collection("users").doc(request.auth.uid);
    const user = await tx.get(userRef);
    const currentCoins = user.data()?.coins || 0;
    tx.update(userRef, { coins: currentCoins + pack.coins });
    tx.set(ledgerRef, { uid: request.auth.uid, packId, coins: pack.coins, createdAt: Date.now() });
  });

  return { coins: pack.coins, alreadyCredited: false };
});
