import { HavenoClient } from "haveno-ts";

// create client connected to Haveno daemon
const alice = new HavenoClient("http://localhost:8080", "hunter1");

// use Haveno daemon
const offers = await alice.getOffers("EUR", "BUY");
if (offers.length === 0) {
    console.log("No offers found");
    await alice.disconnect();
    process.exit(0);
}

const offer = offers[0];
console.log("Offer Details:");
console.table({
    id: offer.getId(),
    direction: offer.getDirection(),
    price: offer.getPrice(),
    useMarketBasedPrice: offer.getUseMarketBasedPrice(),
    marketPriceMarginPct: offer.getMarketPriceMarginPct(),
    amount: offer.getAmount(),
    minAmount: offer.getMinAmount(),
    makerFeePct: offer.getMakerFeePct(),
    takerFeePct: offer.getTakerFeePct(),
    penaltyFeePct: offer.getPenaltyFeePct(),
    buyerSecurityDepositPct: offer.getBuyerSecurityDepositPct(),
    sellerSecurityDepositPct: offer.getSellerSecurityDepositPct(),
    volume: offer.getVolume(),
    minVolume: offer.getMinVolume(),
    triggerPrice: offer.getTriggerPrice(),
    paymentAccountId: offer.getPaymentAccountId(),
    paymentMethodId: offer.getPaymentMethodId(),
    paymentMethodShortName: offer.getPaymentMethodShortName(),
    baseCurrencyCode: offer.getBaseCurrencyCode(),
    counterCurrencyCode: offer.getCounterCurrencyCode(),
    date: offer.getDate(),
    state: offer.getState(),
    isActivated: offer.getIsActivated(),
    isMyOffer: offer.getIsMyOffer(),
    isPrivateOffer: offer.getIsPrivateOffer()
});
// const trade = await alice.takeOffer(offer.getId(), paymentAccounts[0].getId());
// console.log(trade);

// disconnect client
await alice.disconnect();