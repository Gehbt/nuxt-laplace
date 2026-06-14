ALTER TABLE "chat"."messages" ALTER COLUMN "content" SET DATA TYPE jsonb USING (
  jsonb_build_array(jsonb_build_object('type', 'text', 'text', "content"))
);