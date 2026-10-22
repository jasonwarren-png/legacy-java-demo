-- SQLite translation of src/main/resources/db/h2/schema.sql (the default, embedded profile).
-- H2 VARCHAR_IGNORECASE columns become COLLATE NOCASE; seed data is loaded from the H2 data.sql as is.
DROP TABLE IF EXISTS vet_specialties;
DROP TABLE IF EXISTS vets;
DROP TABLE IF EXISTS specialties;
DROP TABLE IF EXISTS visits;
DROP TABLE IF EXISTS pets;
DROP TABLE IF EXISTS types;
DROP TABLE IF EXISTS owners;

CREATE TABLE vets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name VARCHAR(30),
  last_name  VARCHAR(30)
);
CREATE INDEX vets_last_name ON vets (last_name);

CREATE TABLE specialties (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(80)
);
CREATE INDEX specialties_name ON specialties (name);

CREATE TABLE vet_specialties (
  vet_id       INTEGER NOT NULL REFERENCES vets (id),
  specialty_id INTEGER NOT NULL REFERENCES specialties (id)
);

CREATE TABLE types (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(80)
);
CREATE INDEX types_name ON types (name);

CREATE TABLE owners (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name VARCHAR(30),
  last_name  VARCHAR(30) COLLATE NOCASE,
  address    VARCHAR(255),
  city       VARCHAR(80),
  telephone  VARCHAR(20)
);
CREATE INDEX owners_last_name ON owners (last_name);

CREATE TABLE pets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       VARCHAR(30) COLLATE NOCASE,
  birth_date DATE,
  type_id    INTEGER NOT NULL REFERENCES types (id),
  owner_id   INTEGER REFERENCES owners (id),
  CONSTRAINT unique_owner_pet_name UNIQUE (owner_id, name)
);
CREATE INDEX pets_name ON pets (name);

CREATE TABLE visits (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pet_id      INTEGER REFERENCES pets (id),
  visit_date  DATE,
  description VARCHAR(255)
);
CREATE INDEX visits_pet_id ON visits (pet_id);
