import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { sendFileToUser } from "../lib/bot.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      req.log.error({ error }, "Failed to fetch content");
      return res.status(500).json({ error: "Failed to fetch content" });
    }

    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Unexpected error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { data: content, error: contentError } = await supabase
      .from("content")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (contentError || !content) {
      return res.status(404).json({ error: "Content not found" });
    }

    const { data: files, error: filesError } = await supabase
      .from("files")
      .select("*")
      .eq("content_id", req.params.id);

    if (filesError) {
      req.log.error({ error: filesError }, "Failed to fetch files");
    }

    res.json({ ...content, files: files || [] });
  } catch (err) {
    req.log.error({ err }, "Unexpected error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await supabase.from("files").delete().eq("content_id", req.params.id);
    const { error } = await supabase.from("content").delete().eq("id", req.params.id);

    if (error) {
      return res.status(500).json({ error: "Failed to delete content" });
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Unexpected error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/download", async (req, res) => {
  const { user_id, file_id, quality } = req.body;

  if (!user_id || !file_id) {
    return res.status(400).json({ error: "Missing user_id or file_id" });
  }

  try {
    await sendFileToUser(Number(user_id), file_id, quality || "HD");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to send file");
    res.status(500).json({ error: "Failed to send file to user" });
  }
});

export default router;
