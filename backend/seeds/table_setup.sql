DROP TABLE IF EXISTS recipes;
DROP SEQUENCE IF EXISTS recipes_id_seq;

CREATE SEQUENCE IF NOT EXISTS recipes_id_seq;
CREATE TABLE recipes (
  id SERIAL PRIMARY KEY,
  name text,
  cooking_time int,
  rating int
);

INSERT INTO recipes (name, cooking_time, rating) VALUES ('Spinach & Ricotta Filled Pasta', 4, 9);
INSERT INTO recipes (name, cooking_time, rating) VALUES ('Wagyu Steak & Tenderstem Broccoli', 15, 10);
INSERT INTO recipes (name, cooking_time, rating) VALUES ('Mac & Cheese', 8, 1);
