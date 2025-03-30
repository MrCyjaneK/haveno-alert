import { Bot } from "grammy";
import { CommandGroup } from "@grammyjs/commands";

import { HavenoClient, type OfferInfo } from "haveno-ts";

import Keyv from "keyv";
import KeyvSqlite from "@keyv/sqlite";

import {
  compareOffers,
  formatOfferInfo,
  formatWatchOffer,
  isCrypto,
  isFIAT,
  PAYMENT_METHODS,
  sleep,
  toNumberLossy,
  type WatchOffer,
} from "./utils.ts";

const haveno = new HavenoClient(
  process.env.HAVENO_URL!,
  process.env.HAVENO_PASSWORD!,
);

const keyvSqlite = new KeyvSqlite(process.env.DB_PATH);
const keyv = new Keyv<WatchOffer[]>({ store: keyvSqlite });

// #region TELEGRAM BOT STUFF
const bot = new Bot(process.env.BOT_TOKEN!);
const myCommands = new CommandGroup();
bot.use(myCommands);

myCommands.command(
  "start",
  "Start",
  (ctx) => ctx.reply("Use /watch command"),
);

myCommands.command("list", "Lists what offers you're watching", async (ctx) => {
  const userId = String((await ctx.getAuthor()).user.id);
  try {
    const watchOffers = await keyv.get(userId);
    if (!watchOffers?.length) {
      await ctx.reply("You are currently not watching for any offers");
      return;
    }

    let message =
      `You are currently watching for ${watchOffers.length} offers.`;
    for (const watchOffer of watchOffers) {
      message += `\n${formatWatchOffer(watchOffer)}`;
    }

    await ctx.reply(message, { parse_mode: "HTML" });
  } catch (error) {
    await ctx.reply("Failed to fetch for your watch offers :/");
    return;
  }
});

myCommands.command("unwatch", "unwatch {watchOfferId}", async (ctx) => {
  const userId = String((await ctx.getAuthor()).user.id);
  const watchOfferId = ctx.match;
  try {
    const watchOffers = await keyv.get(userId);
    if (!watchOffers?.length) {
      await ctx.reply("You are currently not watching for any offers");
      return;
    }

    const filtered = watchOffers.filter((watchOffer) => {
      if (watchOffer.id === watchOfferId) {
        return false;
      }
      return true;
    });

    if (filtered.length !== watchOffers.length) {
      await keyv.set(userId, filtered);
      await ctx.reply(`Succesfully unwatched ${watchOfferId}`);
      return;
    }

    await ctx.reply(`There is no watch offer with id ${watchOfferId}`);
  } catch (error) {
    await ctx.reply("Failed to fetch for your watch offers :/");
    return;
  }
});

myCommands.command(
  "watch",
  "watch {baseCurrency} {counterCurrency} {paymentMethod?} {price?} {amount?} {minAmount?} {volume?} {minVolume?}",
  async (ctx) => {
    const arr = ctx.match.split(/\s+/);
    if (arr.length == 1 && arr[0] == "") {
      await ctx.reply(
        "Invalid command. Use /watch {baseCurrency} {counterCurrency} {paymentMethod?} {price?} {amount?} {minAmount?} {volume?} {minVolume?}",
      );
      return;
    }

    const groups = {
      baseCurrency: arr[0]?.toUpperCase(),
      counterCurrency: arr[1]?.toUpperCase(),
      paymentMethod: arr[2],
      price: arr[3],
      amount: arr[4],
      minAmount: arr[5],
      volume: arr[6],
      minVolume: arr[7],
    } as const;

    const baseCurrency = groups.baseCurrency!;
    const baseIsFIAT = await isFIAT(baseCurrency);
    if (!baseIsFIAT && !(await isCrypto(baseCurrency))) {
      await ctx.reply("You have to specify valid Base Currency.");
      return;
    }

    const counterCurrency = groups.counterCurrency!;
    if (await isFIAT(counterCurrency)) {
      if (baseIsFIAT) {
        await ctx.reply(
          "Either Base or Counter Currency has to be FIAT. It cannot be both.",
        );
        return;
      }
    } else if (!await isCrypto(counterCurrency)) {
      await ctx.reply("You have to specify valid Counter Currency.");
      return;
    }

    let paymentMethod = groups?.paymentMethod ?? "";
    if (paymentMethod !== "-" && paymentMethod !== "") {
      const possibleValues = PAYMENT_METHODS.filter((sv) => {
        const ucase = paymentMethod.toUpperCase();
        return ucase && sv.includes(ucase);
      });

      if (possibleValues.length > 1) {
        let message = "You have to specify Payment Method more specifically.\n";

        if (possibleValues.length < 5) {
          message += `Which of these did you mean:\n ${
            possibleValues.map((value) => `\n - ${value}`)
          }`;
        }

        await ctx.reply(message, { parse_mode: "HTML" });
        return;
      } else if (!possibleValues.length) {
        await ctx.reply(
          `No Payment Method has been found for: ${paymentMethod}`,
        );
        return;
      } else {
        paymentMethod = possibleValues[0];
      }
    }

    const price = await toNumberLossy(groups.price);
    const amount = await toNumberLossy(groups.amount);
    const minAmount = await toNumberLossy(groups.minAmount);
    const volume = await toNumberLossy(groups.volume);
    const minVolume = await toNumberLossy(groups.minVolume);

    const userId = String((await ctx.getAuthor()).user.id);
    const channelId = String((await ctx.getChat()).id);
    const watchOffer: WatchOffer = {
      id: crypto.randomUUID(),
      userId,
      channelId,
      baseCurrency,
      counterCurrency,
      paymentMethod,
      price,
      amount,
      minAmount,
      volume,
      minVolume,
    };

    try {
      await ctx.reply(
        formatWatchOffer(watchOffer),
        { parse_mode: "HTML" },
      );
    } catch (error) {
      console.warn(error);
      await ctx.reply("Invalid watch request");
      return;
    }

    try {
      const existing = await keyv.get(userId);
      await keyv.set(
        userId,
        existing ? [...existing.values(), watchOffer] : [watchOffer],
      );
      await ctx.reply("Successfully started watching for offers!");
    } catch (error) {
      await ctx.reply(
        "Something failed while we tried to add this watch request :/",
      );
    }
  },
);

await myCommands.setCommands(bot);

void bot.start();
// #endregion

// #region Watching logic
const watchKeyvSqlite = new KeyvSqlite(process.env.WATCH_DB_PATH);
const watchKeyv = new Keyv<string[]>({ store: watchKeyvSqlite });
const REFRESH_INTERVAL = 1000 * 30; // fetch new offers every 30s
let knownOfferInfos: Map<string, Set<string>> | undefined;

async function watchOffers() {
  if (!keyv?.iterator) {
    console.error("MISSING KEYV ITERATOR");
    return;
  }

  if (!watchKeyv?.iterator) {
    console.error("MISSING WATCH KEYV ITERATOR");
    return;
  }

  if (!knownOfferInfos) {
    console.log("Loading knownOfferInfos");

    knownOfferInfos = new Map<string, Set<string>>();
    const iterator: AsyncGenerator<[string, string[]]> = watchKeyv.iterator(0);
    for await (const [id, ids] of iterator) {
      console.log(id, ids);
      knownOfferInfos.set(id, new Set(ids));
    }
  }

  console.log("Watching offers");

  const assetCodes = new Set<string>();
  const watchedOffers = [];
  const foundOffers = new Map<WatchOffer, OfferInfo[]>();

  const iterator: AsyncGenerator<[string, WatchOffer[]]> = keyv.iterator(0);
  for await (const [_, watchOffers] of iterator) {
    for (const watchOffer of watchOffers) {
      assetCodes.add(watchOffer.baseCurrency);
      assetCodes.add(watchOffer.counterCurrency);
      watchedOffers.push(watchOffer);
    }
  }

  console.log("Asset codes:", assetCodes.size);
  console.log("Watched offers:", watchedOffers.length);

  asset: for (const asset of assetCodes) {
    console.log("Get offers for", asset);
    let offers: OfferInfo[];
    try {
      offers = await haveno.getOffers(asset, "any" as any);
    } catch (error) {
      console.log(`Haveno errored on getOffer('${asset}', 'any'):`, error);
      console.log(
        "Skipping current asset, sleeping for 10s and trying the next one...",
      );
      await sleep(1000 * 10);
      continue asset;
    }

    console.log(`Got ${offers.length} offers...`);
    for (const offer of offers) {
      for (const watchedOffer of watchedOffers) {
        if (compareOffers(offer, watchedOffer)) {
          const knownOffers = knownOfferInfos.get(watchedOffer.id);

          if (knownOffers?.has(offer.getId())) {
            continue;
          } else if (knownOffers) {
            knownOffers.add(offer.getId());
          } else {
            const known = new Set<string>();
            known.add(offer.getId());
            knownOfferInfos.set(watchedOffer.id, known);
            await watchKeyv.set(watchedOffer.id, Array.from(known));
          }

          const current = foundOffers.get(watchedOffer);
          if (current) {
            current.push(offer);
          } else {
            foundOffers.set(watchedOffer, [offer]);
          }
        }
      }
    }

    for (const [watchedOffer, offers] of foundOffers.entries()) {
      const messages = [];
      let message =
        `<a href='tg://user?id=${watchedOffer.userId}'>Hey</a>, I have found ${offers.length} offers matching your filters!`;

      for (const offer of offers) {
        if (message.length > 3072) {
          messages.push(message);
          message = "";
        }

        message += "\n" + formatOfferInfo(offer);
      }
      messages.push(message);

      for (const message of messages) {
        await bot.api.sendMessage(watchedOffer.channelId, message, {
          parse_mode: "HTML",
        });
        await sleep(1000);
      }
    }
    foundOffers.clear();

    await sleep(REFRESH_INTERVAL);
  }

  setTimeout(watchOffers, REFRESH_INTERVAL);
}

setTimeout(watchOffers, 1000);
//#endregion
