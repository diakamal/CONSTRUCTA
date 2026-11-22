-- Local development seed. TEST DATA ONLY.
-- Manager login (web):  manager@constructa.test / Test1234!
-- Worker logins (mobile, phone OTP; fixed codes in supabase/config.toml [auth.sms.test_otp]):
--   +972500000001 (Ahmad, Arabic)   code 123456
--   +972500000002 (Somchai, Thai)   code 123456

do $$
declare
  v_org     uuid := '00000000-0000-0000-0000-0000000000a1';
  v_mgr     uuid := '00000000-0000-0000-0000-0000000000b1';
  v_w1      uuid := '00000000-0000-0000-0000-0000000000b2';
  v_w2      uuid := '00000000-0000-0000-0000-0000000000b3';
  v_team    uuid := '00000000-0000-0000-0000-0000000000c1';
  v_prj     uuid := '00000000-0000-0000-0000-0000000000d1';
  v_bldg    uuid := gen_random_uuid();
  v_floor   uuid;
  v_unit    uuid;
  f int; u int;
begin
  insert into organizations (id, name) values (v_org, 'קבלן דמו בע"מ');
  insert into teams (id, org_id, name, subcontractor_name) values (v_team, v_org, 'צוות אינסטלציה', 'אינסטלציה כהן');

  -- Manager (email + password)
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_mgr, 'authenticated', 'authenticated',
          'manager@constructa.test', crypt('Test1234!', gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_mgr, v_mgr::text,
          jsonb_build_object('sub', v_mgr::text, 'email', 'manager@constructa.test'),
          'email', now(), now(), now());
  insert into profiles (id, org_id, role, full_name, language)
  values (v_mgr, v_org, 'manager', 'יוסי מנהל עבודה', 'he');

  -- Project in Tel Aviv, 150 m geofence
  insert into projects (id, org_id, name, address, lat, lng, radius_m)
  values (v_prj, v_org, 'מגדלי הים – בניין A', 'רחוב הדוגמה 1, תל אביב', 32.0853, 34.7818, 150);
  insert into project_members values (v_prj, v_mgr);

  -- Building A → floors 1-3 → apartments → bathroom
  insert into locations (id, project_id, kind, name) values (v_bldg, v_prj, 'building', 'בניין A');
  for f in 1..3 loop
    insert into locations (project_id, parent_id, kind, name, sort)
    values (v_prj, v_bldg, 'floor', 'קומה ' || f, f) returning id into v_floor;
    for u in 1..2 loop
      insert into locations (project_id, parent_id, kind, name, sort)
      values (v_prj, v_floor, 'unit', 'דירה ' || (f * 10 + u), u) returning id into v_unit;
      insert into locations (project_id, parent_id, kind, name) values (v_prj, v_unit, 'room', 'חדר רחצה');
    end loop;
  end loop;

  -- Workers: invitation first, then the auth user (as if they signed in with OTP) → trigger creates profile
  insert into invitations (org_id, phone, full_name, language, team_id, project_ids, created_by) values
    (v_org, '972500000001', 'אחמד', 'ar', v_team, array[v_prj], v_mgr),
    (v_org, '972500000002', 'Somchai', 'th', null, array[v_prj], v_mgr);

  insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values
    ('00000000-0000-0000-0000-000000000000', v_w1, 'authenticated', 'authenticated', '972500000001', now(),
     '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_w2, 'authenticated', 'authenticated', '972500000002', now(),
     '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', '');

  -- Today's tasks
  insert into tasks (project_id, location_id, title, instructions, video_url, team_id, scheduled_date, created_by)
  select v_prj, l.id, 'התקנת ניקוז מקלחת – ' || p.name,
         'לוודא שיפוע 2% לכיוון הניקוז. לצלם את הניקוז לפני סגירת הריצוף.',
         null, v_team, current_date, v_mgr
  from locations l join locations p on p.id = l.parent_id
  where l.project_id = v_prj and l.kind = 'room';

  insert into tasks (project_id, location_id, title, instructions, assignee_id, scheduled_date, created_by)
  select v_prj, id, 'ניקוי וסילוק פסולת – ' || name, 'לפנות פסולת למכולה בחניה.', v_w2, current_date, v_mgr
  from locations where project_id = v_prj and kind = 'floor';
end $$;
