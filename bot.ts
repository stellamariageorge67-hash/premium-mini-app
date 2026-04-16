import { Telegraf, session, Markup } from "telegraf";
import type { Context } from "telegraf";
import { supabase } from "./supabase.js";
import { logger } from "./logger.js";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const ADMIN_ID = parseInt(process.env.ADMIN_ID || "0", 10);

export const bot = new Telegraf(BOT_TOKEN);

type UploadSession = {
  step?: string;
  type?: string;
  title?: string;
  genre?: string;
  poster_url?: string;
  trailer_url?: string;
  about_text?: string;
  content_id?: string;
  files?: Array<{ quality: string; telegram_file_id: string }>;
  awaitingQuality?: boolean;
  pendingFileId?: string;
};

type BotSession = {
  upload?: UploadSession;
};

interface BotContext extends Context {
  session: BotSession;
}

bot.use(session());

function isAdmin(ctx: BotContext): boolean {
  return ctx.from?.id === ADMIN_ID;
}

bot.start((ctx: BotContext) => {
  const miniAppUrl = `${process.env.MINI_APP_URL || "https://t.me"}`;
  ctx.reply(
    `🎥 Welcome to *DY SHOWS*!\n\nDiscover and download the latest movies and series.\n\nTap the button below to open the app:`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        Markup.button.webApp("🎬 Open DY SHOWS", miniAppUrl),
      ]),
    }
  );
});

bot.command("admin", (ctx: BotContext) => {
  if (!isAdmin(ctx)) return ctx.reply("⛔ Unauthorized.");
  const adminUrl = `${process.env.MINI_APP_URL || "https://t.me"}?admin=1`;
  ctx.reply("👑 Admin Panel", {
    ...Markup.inlineKeyboard([
      Markup.button.webApp("Open Admin Panel", adminUrl),
    ]),
  });
});

bot.command("upload", (ctx: BotContext) => {
  if (!isAdmin(ctx)) return ctx.reply("⛔ Unauthorized.");
  ctx.session = { upload: { step: "type" } };
  ctx.reply(
    "📤 *New Upload*\n\nWhat type of content are you uploading?",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🎬 Single Movie", "type_movie")],
        [Markup.button.callback("📺 Series", "type_series")],
      ]),
    }
  );
});

bot.action("type_movie", (ctx: BotContext) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("⛔ Unauthorized.");
  ctx.session.upload = { ...ctx.session.upload, type: "movie", step: "title" };
  ctx.answerCbQuery();
  ctx.reply("✏️ Send me the *title* of the movie:", { parse_mode: "Markdown" });
});

bot.action("type_series", (ctx: BotContext) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("⛔ Unauthorized.");
  ctx.session.upload = { ...ctx.session.upload, type: "series", step: "title" };
  ctx.answerCbQuery();
  ctx.reply("✏️ Send me the *title* of the series:", { parse_mode: "Markdown" });
});

bot.action("add_more_files", async (ctx: BotContext) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("⛔ Unauthorized.");
  ctx.session.upload = { ...ctx.session.upload, step: "files", awaitingQuality: false };
  ctx.answerCbQuery();
  ctx.reply("📁 Send the next file (document/video):");
});

bot.action("done_files", async (ctx: BotContext) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("⛔ Unauthorized.");
  ctx.answerCbQuery();

  const upload = ctx.session.upload || {};
  try {
    const { data: content, error: contentError } = await supabase
      .from("content")
      .insert({
        title: upload.title,
        type: upload.type,
        genre: upload.genre,
        poster_url: upload.poster_url,
        trailer_url: upload.trailer_url,
        about_text: upload.about_text,
        rating: 0,
      })
      .select()
      .single();

    if (contentError || !content) {
      logger.error({ error: contentError }, "Failed to insert content");
      ctx.reply("❌ Failed to save content. Please try again.");
      return;
    }

    const files = upload.files || [];
    for (const file of files) {
      await supabase.from("files").insert({
        content_id: content.id,
        quality: file.quality,
        telegram_file_id: file.telegram_file_id,
      });
    }

    ctx.session.upload = {};
    ctx.reply(
      `✅ *"${upload.title}"* has been uploaded successfully!\n\n📊 ${files.length} quality version(s) saved.`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    logger.error({ err }, "Upload error");
    ctx.reply("❌ An error occurred. Please try again.");
  }
});

bot.on("message", async (ctx: BotContext) => {
  const upload = ctx.session?.upload;
  if (!upload || !upload.step) return;
  if (!isAdmin(ctx)) return;

  const msg = ctx.message as any;
  const text = msg.text || "";

  if (upload.step === "title") {
    ctx.session.upload = { ...upload, title: text, step: "genre" };
    ctx.reply("🎭 Send me the *genre* (e.g., Action, Horror, Romance):", { parse_mode: "Markdown" });
    return;
  }

  if (upload.step === "genre") {
    ctx.session.upload = { ...upload, genre: text, step: "poster" };
    ctx.reply("🖼️ Send me the *poster image URL*:", { parse_mode: "Markdown" });
    return;
  }

  if (upload.step === "poster") {
    ctx.session.upload = { ...upload, poster_url: text, step: "trailer" };
    ctx.reply("▶️ Send me the *YouTube trailer URL*:", { parse_mode: "Markdown" });
    return;
  }

  if (upload.step === "trailer") {
    ctx.session.upload = { ...upload, trailer_url: text, step: "about" };
    ctx.reply("📝 Send me the *about/summary* text:", { parse_mode: "Markdown" });
    return;
  }

  if (upload.step === "about") {
    ctx.session.upload = { ...upload, about_text: text, step: "files", files: [] };
    ctx.reply(
      "📁 Now send the *first file* (document or video) to upload:",
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (upload.step === "files") {
    if (upload.awaitingQuality && upload.pendingFileId) {
      const quality = text.trim();
      const files = [...(upload.files || []), { quality, telegram_file_id: upload.pendingFileId }];
      ctx.session.upload = { ...upload, files, awaitingQuality: false, pendingFileId: undefined };
      ctx.reply(
        `✅ File saved as *${quality}*.\n\nAdd another quality version?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("➕ Add Another Quality", "add_more_files")],
            [Markup.button.callback("✅ Done — Save Content", "done_files")],
          ]),
        }
      );
      return;
    }

    const fileId =
      msg.document?.file_id ||
      msg.video?.file_id ||
      msg.audio?.file_id;

    if (fileId) {
      ctx.session.upload = { ...upload, pendingFileId: fileId, awaitingQuality: true };
      ctx.reply("🏷️ What quality is this file? (e.g. *1080p*, *720p*, *480p*)", { parse_mode: "Markdown" });
    } else {
      ctx.reply("⚠️ Please send a file (document/video), not text.");
    }
    return;
  }
});

bot.command("request", async (ctx: BotContext) => {
  const parts = (ctx.message as any)?.text?.split(" ").slice(1);
  const movieName = parts?.join(" ");
  if (!movieName) return ctx.reply("Usage: /request <movie name>");

  const userId = ctx.from?.id;
  const { error } = await supabase.from("requests").insert({
    user_id: userId,
    movie_name: movieName,
    status: "pending",
  });

  if (error) {
    ctx.reply("❌ Failed to submit request. Try again.");
  } else {
    ctx.reply(`✅ Your request for *"${movieName}"* has been submitted!`, { parse_mode: "Markdown" });
  }
});

export async function sendFileToUser(userId: number, fileId: string, quality: string): Promise<void> {
  try {
    await bot.telegram.sendDocument(userId, fileId, {
      caption: `🎬 Your *${quality}* download is ready!`,
      parse_mode: "Markdown",
    });
  } catch (err) {
    logger.error({ err, userId, fileId }, "Failed to send file to user");
    throw err;
  }
}
