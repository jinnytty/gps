
create table gps_tracking (
  id serial primary key,
  name text not null,
  key text unique not null,
  started timestamptz not null,
  ended timestamptz
);
create index on gps_tracking(key);

create table gps_log (
  id serial primary key,
  tracking_id int not null references gps_tracking(id) on delete cascade, 
  distance decimal not null,
  started timestamptz not null,
  last timestamptz not null,
  active boolean not null
);
create index on gps_log(tracking_id);
create index on gps_log(started);

create table access_token (
  id serial primary key,
  key text not null references gps_tracking(key) on update cascade on delete cascade,
  token text not null,
  readonly boolean not null default true,
  created timestamptz not null
);
create index on access_token(token);

create table map_config (
  id serial primary key,
  name text not null,
  created timestamptz not null,
  data jsonb not null
);

