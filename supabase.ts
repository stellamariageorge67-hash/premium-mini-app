import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export type Content = {
  id: string;
  title: string;
  type: "movie" | "series";
  genre: string;
  poster_url: string;
  trailer_url: string;
  about_text: string;
  rating: number;
  created_at: string;
};

export type FileEntry = {
  id: string;
  content_id: string;
  quality: string;
  telegram_file_id: string;
};

export type Request = {
  id: string;
  user_id: number;
  movie_name: string;
  status: string;
};
