CREATE TABLE "chat"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"peer_id" varchar NOT NULL,
	"timestamp" bigint NOT NULL,
	"room_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat"."rooms" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat"."messages" ADD CONSTRAINT "messages_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "chat"."rooms"("id") ON DELETE cascade ON UPDATE no action;