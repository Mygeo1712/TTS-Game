CREATE TABLE public.leaderboard (
  id integer NOT NULL DEFAULT nextval('leaderboard_id_seq'::regclass),
  puzzle_id integer,
  player_id text,
  completion_time integer,
  completion_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT leaderboard_pkey PRIMARY KEY (id),
  CONSTRAINT leaderboard_puzzle_id_fkey FOREIGN KEY (puzzle_id) REFERENCES public.puzzles(id)
);
CREATE TABLE public.puzzle_rooms (
  room_id character varying NOT NULL,
  puzzle_id integer NOT NULL,
  start_time timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  global_grid jsonb DEFAULT '[]'::jsonb,
  hints_remaining integer DEFAULT 3,
  hint_cells text DEFAULT '[]'::text,
  is_won boolean DEFAULT false,
  winner_id text,
  CONSTRAINT puzzle_rooms_pkey PRIMARY KEY (room_id, puzzle_id),
  CONSTRAINT puzzle_rooms_puzzle_id_fkey FOREIGN KEY (puzzle_id) REFERENCES public.puzzles(id)
);
CREATE TABLE public.puzzle_words (
  id integer NOT NULL DEFAULT nextval('puzzle_words_id_seq'::regclass),
  puzzle_id integer,
  answer character varying NOT NULL,
  clue text NOT NULL,
  row_pos integer NOT NULL,
  col_pos integer NOT NULL,
  direction character varying NOT NULL,
  word_number integer NOT NULL,
  CONSTRAINT puzzle_words_pkey PRIMARY KEY (id),
  CONSTRAINT puzzle_words_puzzle_id_fkey FOREIGN KEY (puzzle_id) REFERENCES public.puzzles(id)
);
CREATE TABLE public.puzzles (
  id integer NOT NULL DEFAULT nextval('puzzles_id_seq'::regclass),
  title character varying NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  difficulty character varying,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT puzzles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.room_players (
  id integer NOT NULL DEFAULT nextval('room_players_id_seq'::regclass),
  room_id character varying NOT NULL,
  player_id character varying NOT NULL,
  last_cursor jsonb DEFAULT '{"c": 0, "r": 0}'::jsonb,
  last_active timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT room_players_pkey PRIMARY KEY (id)
);