BEGIN;

DO $$
DECLARE
  halaqa_id constant uuid := 'e1934ee8-fd6a-477a-9528-ca575e68b550';
  complete_student constant uuid := 'd00d0000-0000-4000-8000-000000000260';
  gap_student constant uuid := 'd00d0000-0000-4000-8000-000000000261';
  plan_student constant uuid := 'd00d0000-0000-4000-8000-000000000262';
  expected constant integer[] := ARRAY[1,8,13,24,32,37,45,56,65,69,77,84,91,96,101,109,113,120,127,134,142,149,153,161,171,177,184,189,194,198,204,210,218,223,227,232,238,241,245,253,256,260,264,267,272,277,282,289,290,294,303,309,316,323,331,339,346,355,364,371,377,385,394,402,409,415,426,434,442,447,451,459,467,474,480,488,494,500,505,508,513,517,520,527,531,538,545,553,559,568,573,580,585,588,595,599,607,615,621,628,634,641,648,656,664,669,672,675,679,683,687,693,701,706,711,715,720,727,734,740,746,752,759,765,773,778,783,790,798,808,817,825,834,842,849,858,863,871,880,884,891,900,908,914,921,927,932,936,941,947,955,966,977,985,992,998,1006,1012,1022,1028,1036,1042,1050,1059,1075,1085,1092,1098,1104,1110,1114,1118,1125,1133,1142,1150,1161,1169,1177,1186,1194,1201,1206,1213,1222,1230,1236,1242,1249,1256,1262,1267,1272,1276,1283,1290,1297,1304,1308,1315,1322,1329,1335,1342,1347,1353,1358,1365,1371,1379,1385,1390,1398,1407,1418,1426,1435,1443,1453,1462,1471,1479,1486,1493,1502,1511,1519,1527,1536,1545,1555,1562,1571,1582,1591,1601,1611,1619,1627,1634,1640,1649,1660,1666,1675,1683,1692,1700,1708,1713,1721,1726,1736,1742,1750,1756,1761,1769,1775,1784,1793,1803,1818,1834,1854,1873,1893,1908,1916,1928,1936,1944,1956,1966,1974,1981,1989,1995,2004,2012,2020,2030,2037,2047,2057,2068,2079,2088,2096,2105,2116,2126,2134,2145,2156,2161,2168,2175,2186,2194,2202,2215,2224,2238,2251,2262,2276,2289,2302,2315,2327,2346,2361,2386,2400,2413,2425,2436,2447,2462,2474,2484,2494,2508,2519,2528,2541,2556,2565,2574,2585,2596,2601,2611,2619,2626,2634,2642,2651,2660,2668,2674,2691,2701,2716,2733,2748,2763,2778,2792,2802,2812,2819,2823,2828,2835,2845,2850,2853,2858,2867,2876,2888,2899,2911,2923,2933,2952,2972,2993,3016,3044,3069,3092,3116,3139,3160,3173,3182,3195,3204,3215,3223,3236,3248,3258,3266,3274,3281,3288,3296,3303,3312,3323,3330,3337,3347,3355,3364,3371,3379,3386,3393,3404,3415,3425,3434,3442,3451,3460,3470,3481,3489,3498,3504,3515,3524,3534,3540,3549,3556,3564,3569,3577,3584,3588,3596,3607,3614,3621,3629,3638,3646,3655,3664,3672,3679,3691,3699,3705,3718,3733,3746,3760,3776,3789,3813,3840,3865,3891,3915,3942,3971,3987,3997,4013,4032,4054,4064,4069,4080,4090,4099,4106,4115,4126,4133,4141,4150,4159,4167,4174,4183,4192,4200,4211,4219,4230,4239,4248,4257,4265,4273,4283,4288,4295,4304,4317,4324,4336,4348,4359,4373,4386,4399,4415,4433,4454,4474,4487,4496,4506,4516,4525,4531,4539,4546,4557,4565,4575,4584,4593,4599,4607,4612,4617,4624,4631,4646,4666,4682,4706,4727,4750,4767,4785,4811,4829,4853,4874,4896,4918,4942,4969,4996,5030,5056,5079,5087,5094,5100,5105,5111,5116,5126,5130,5136,5143,5151,5156,5162,5169,5178,5186,5193,5200,5209,5218,5223,5230,5237,5242,5254,5268,5287,5314,5332,5358,5386,5415,5430,5448,5461,5476,5495,5513,5543,5571,5597,5617,5642,5673,5703,5728,5759,5801,5830,5855,5883,5910,5932,5964,5994,6017,6044,6073,6099,6126,6138,6156,6177,6194,6208,6222,6237]::integer[];
  p integer;
  seg record;
  rejected boolean;
BEGIN
  -- 604 pages require 605 delimiters, including the ayah after the last page.
  IF array_length(expected,1) IS DISTINCT FROM 605 THEN RAISE EXCEPTION 'fixture must contain 605 delimiters'; END IF;
  IF public.mem_page_starts() IS DISTINCT FROM expected THEN RAISE EXCEPTION 'generated page table differs from Quran index'; END IF;
  FOR p IN 1..604 LOOP
    SELECT * INTO seg FROM public.mem_segment('صفحة ' || p, 'صفحة ' || p);
    IF seg.start_ayah IS DISTINCT FROM expected[p] THEN RAISE EXCEPTION 'page % start mismatch: %',p,seg.start_ayah; END IF;
    IF seg.end_ayah IS DISTINCT FROM expected[p+1]-1 THEN RAISE EXCEPTION 'page % end mismatch: %',p,seg.end_ayah; END IF;
  END LOOP;
  IF (public.mem_segment('صفحة 323','صفحة 323')).start_ayah IS DISTINCT FROM 2494 OR (public.mem_segment('صفحة 323','صفحة 323')).end_ayah IS DISTINCT FROM 2507 THEN RAISE EXCEPTION 'page 323 landmark failed'; END IF;
  IF (public.mem_segment('صفحة 582','صفحة 582')).start_ayah IS DISTINCT FROM 5673 OR (public.mem_segment('صفحة 582','صفحة 582')).end_ayah IS DISTINCT FROM 5702 THEN RAISE EXCEPTION 'page 582 landmark failed'; END IF;
  IF (public.mem_segment('صفحة 604','صفحة 604')).start_ayah IS DISTINCT FROM 6222 OR (public.mem_segment('صفحة 604','صفحة 604')).end_ayah IS DISTINCT FROM 6236 THEN RAISE EXCEPTION 'page 604 landmark failed'; END IF;

  IF public.mem_ayah('الفاتحة 7') IS DISTINCT FROM 7 THEN RAISE EXCEPTION 'first-surah boundary failed'; END IF;
  IF public.mem_ayah('الناس 6') IS DISTINCT FROM 6236 THEN RAISE EXCEPTION 'last-ayah boundary failed'; END IF;
  IF public.mem_ayah('الناس 7') IS NOT NULL THEN RAISE EXCEPTION 'invalid last-surah ayah accepted'; END IF;
  IF public.mem_ayah('المؤمنون 1') IS DISTINCT FROM 2674 THEN RAISE EXCEPTION 'Arabic normalization failed'; END IF;

  INSERT INTO public.students (id, full_name, halaqa_id, status) VALUES
    (complete_student, 'اختبار دمج نطاقات مؤقت', halaqa_id, 'active'),
    (gap_student, 'اختبار فجوة مؤقت', halaqa_id, 'active'),
    (plan_student, 'اختبار مستهدف خطة مؤقت', halaqa_id, 'active');

  -- Two overlapping segments must merge into one uninterrupted Hizb 60.
  INSERT INTO public.student_memorization_ranges (student_id, start_ayah, end_ayah, from_label, to_label) VALUES
    (complete_student, 5949, 6100, 'الأعلى 1', 'موضع متداخل'),
    (complete_student, 6050, 6236, 'موضع متداخل', 'الناس 6'),
    (complete_student, 5673, 5800, 'النبإ 1', 'جزء غير مكتمل'),
    (gap_student, 5949, 6235, 'الأعلى 1', 'الناس 5');

  IF public.mem_completed(complete_student) IS DISTINCT FROM ARRAY[60]::integer[] THEN
    RAISE EXCEPTION 'overlap/partial Hizb aggregation failed: %', public.mem_completed(complete_student);
  END IF;
  IF public.mem_completed(gap_student) IS DISTINCT FROM '{}'::integer[] THEN
    RAISE EXCEPTION 'gap incorrectly completed a Hizb';
  END IF;
  IF public.himmah_validated_hizbs(complete_student,'[60,60]'::jsonb) IS DISTINCT FROM ARRAY[60]::integer[] THEN
    RAISE EXCEPTION 'shared eligibility validator rejected a verified Hizb';
  END IF;
  rejected := false;
  BEGIN
    PERFORM public.himmah_validated_hizbs(gap_student,'[60]'::jsonb);
  EXCEPTION WHEN OTHERS THEN rejected := true;
  END;
  IF rejected IS DISTINCT FROM true THEN RAISE EXCEPTION 'shared eligibility validator accepted an incomplete Hizb'; END IF;

  -- Planned pages are targets, not evidence of memorization.
  INSERT INTO public.student_annual_plans (student_id, halaqa_id, total_target_pages, daily_memorization_pages)
  VALUES (plan_student, halaqa_id, 604, 1);
  IF public.mem_completed(plan_student) IS DISTINCT FROM '{}'::integer[] THEN
    RAISE EXCEPTION 'plan target incorrectly counted as memorization';
  END IF;

  UPDATE public.student_annual_plans
  SET previous_memorized_ranges = '[{"from":"الفاتحة 1","to":"البقرة 74","pages":4}]'::jsonb
  WHERE student_id = plan_student;
  IF public.mem_completed(plan_student) IS DISTINCT FROM ARRAY[1]::integer[] THEN
    RAISE EXCEPTION 'documented previous plan range was not counted';
  END IF;

  -- Madarij stores its two endpoints in one text value; the full range must be parsed, not a one-character suffix.
  INSERT INTO public.madarij_enrollments (id, student_id, track_id, part_number, hizb_number, start_date, end_date, daily_pace, days_planned, status)
  VALUES ('d00d0000-0000-4000-8000-000000000264', plan_student, 'f4e20372-a816-46e4-94f2-bfaaf2625906', 30, 59, CURRENT_DATE, CURRENT_DATE + 20, 1, 20, 'active');
  INSERT INTO public.madarij_daily_progress (enrollment_id, student_id, progress_date, memorization)
  VALUES ('d00d0000-0000-4000-8000-000000000264', plan_student, CURRENT_DATE, 'النبأ 1 - الطارق 17');
  IF public.mem_completed(plan_student) IS DISTINCT FROM ARRAY[1,59]::integer[] THEN
    RAISE EXCEPTION 'Madarij combined memorization range was not parsed completely: %', public.mem_completed(plan_student);
  END IF;
END $$;

ROLLBACK;
