import type { OfferInfo } from "haveno-ts";

import CRYPTO_CURRENCIES from "./data/crypto_currencies.json" with {
  type: "json",
};
import PAYMENT_METHODS from "./data/payment_methods.json" with { type: "json" };

export { CRYPTO_CURRENCIES, PAYMENT_METHODS };

export async function isCrypto(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  return CRYPTO_CURRENCIES.some((crypto) => value === crypto);
}

export async function isFIAT(value: string | undefined): Promise<boolean> {
  if (!value || value.length !== 3) return false;
  return CRYPTO_CURRENCIES.every((crypto) => value !== crypto);
}

export async function toNumberLossy(
  value: string | undefined,
): Promise<number | undefined> {
  const number = parseFloat(value!);
  return isNaN(number) ? undefined : number;
}

export interface WatchOffer {
  id: string;
  userId: string;
  channelId: string;

  baseCurrency: string;
  counterCurrency: string;
  paymentMethod: string;
  price?: number;
  amount?: number;
  minAmount?: number;
  volume?: number;
  minVolume?: number;
}

export function formatWatchOffer(watchOffer: WatchOffer): string {
  return `
<b>Watch info ${watchOffer.id}</b>
Base currency: ${watchOffer.baseCurrency}
Counter currency: ${watchOffer.counterCurrency}
Payment method: ${watchOffer.paymentMethod}
Price: ${watchOffer.price ?? "any"}
Amount: ${watchOffer.amount ?? "any"}
Min. Amount : ${watchOffer.minAmount ?? "any"}
Volume: ${watchOffer.volume ?? "any"}
Min volume: ${watchOffer.minVolume ?? "any"}`;
}

export function formatOfferInfo(offer: OfferInfo): string {
  return `
<b>Offer ${offer.getId()}</b>
Base currency: ${offer.getBaseCurrencyCode()}
Counter currency: ${offer.getCounterCurrencyCode()}
Payment method: ${offer.getPaymentMethodShortName()}
Price: ${offer.getPrice()} ${offer.getCounterCurrencyCode()}
Amount: ${offer.getAmount() ? (parseFloat(offer.getAmount()) / 1e12).toString() : "any"} <b>${offer.getBaseCurrencyCode()}</b>
Min. Amount : ${offer.getMinAmount() ? (parseFloat(offer.getMinAmount()) / 1e12).toString() : "any"} <b>${offer.getBaseCurrencyCode()}</b>
Volume: ${offer.getVolume() ?? "any"} <b>${offer.getCounterCurrencyCode()}</b>
Min volume: ${offer.getMinVolume() ?? "any"} <b>${offer.getCounterCurrencyCode()}</b>`;
}

export function compareOffers(
  offer: OfferInfo,
  watchedOffer: WatchOffer,
): boolean {
  if (offer.getPaymentMethodId() !== watchedOffer.paymentMethod && watchedOffer.paymentMethod != "") {
    return false;
  }

  if (offer.getBaseCurrencyCode() !== watchedOffer.baseCurrency) {
    return false;
  }

  if (offer.getCounterCurrencyCode() !== watchedOffer.counterCurrency) {
    return false;
  }

  for (
    const key of ["amount", "minAmount", "volume", "minVolume"] as const
  ) {
    const capitalized =
      (key.slice(0, 1).toUpperCase() + key.slice(1)) as Capitalize<typeof key>;

    if (
      typeof watchedOffer[key] === "number" &&
      parseFloat(offer[`get${capitalized}`]()) < watchedOffer[key]
    ) return false;
  }

  if (
    typeof watchedOffer.price === "number" &&
    parseFloat(offer.getPrice()) > watchedOffer.price
  ) return false;

  return true;
}

export async function sleep(millis: number): Promise<void> {
  return new Promise((r) => setTimeout(r, millis));
}
