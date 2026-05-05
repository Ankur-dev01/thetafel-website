CREATE TABLE push_tokens (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token   text NOT NULL,
  device_platform   text NOT NULL,
  is_active         bool DEFAULT true,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner access push_tokens"
  ON push_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
