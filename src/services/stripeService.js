import { getFunctions, httpsCallable } from "firebase/functions";
import { loadStripe } from "@stripe/stripe-js";
import { firebaseApp } from "../config/firebase";
import { STRIPE_PK } from "../config/constants";

export async function createCoinCheckoutSession(packId) {
  const functions = getFunctions(firebaseApp);
  const createPaymentIntent = httpsCallable(functions, "createCoinPaymentIntent");
  return createPaymentIntent({ packId });
}

export async function getStripeInstance() {
  return loadStripe(STRIPE_PK);
}
