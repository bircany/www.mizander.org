-- Supabase SQL Editor: yedi grubun bir hisse fiyatı 5.000 TL'dir.
-- Fotoğrafı panelden Medya'ya yükleyip ID'sini öğrenirseniz v_image_id'ye yazın.
-- NULL bırakırsanız fotoğrafı bağış alanı düzenleme ekranından sonra seçebilirsiniz.
-- Kayıtlar TASLAK oluşturulur: web sitesinde ödeme/bağışa açılmaz,
-- yönetim panelindeki manuel makbuzlu bağış formunda seçilebilir.

begin;

do $seed$
declare
  v_prices numeric[] := array[
    5000, -- 1 kişilik grubun BİR HİSSE fiyatı (TL)
    5000, -- 2 kişilik grubun BİR HİSSE fiyatı (TL)
    5000, -- 3 kişilik grubun BİR HİSSE fiyatı (TL)
    5000, -- 4 kişilik grubun BİR HİSSE fiyatı (TL)
    5000, -- 5 kişilik grubun BİR HİSSE fiyatı (TL)
    5000, -- 6 kişilik grubun BİR HİSSE fiyatı (TL)
    5000  -- 7 kişilik grubun BİR HİSSE fiyatı (TL)
  ]::numeric[];
  v_image_id integer := null; -- Aynı kapak fotoğrafı yedi alanda kullanılabilir.
  v_slaughter_script text := 'Kesimde okunacak metindir.';
  -- Bu ifade geçiciyse gerçek kesim operasyonundan önce panelde onaylı metinle değiştirin.
  v_category_id integer;
  v_capacity integer;
  v_campaign_id integer;
  v_slug text;
  v_title text;
begin
  if coalesce(array_length(v_prices, 1), 0) <> 7
     or exists (select 1 from unnest(v_prices) as p(price)
                where p.price is null or p.price <= 0) then
    raise exception 'Önce 1–7 kişilik grupların yedi hisse fiyatını da pozitif TL tutarı olarak doldurun.';
  end if;
  if nullif(btrim(v_slaughter_script), '') is null then
    raise exception 'Önce kesimde okunacak onaylı metni doldurun.';
  end if;

  select id into v_category_id
  from public.categories
  where slug = 'kurban' and is_active = true;
  if v_category_id is null then
    raise exception 'Aktif Kurban kategorisi bulunamadı.';
  end if;
  if v_image_id is not null
     and not exists (select 1 from public.media where id = v_image_id) then
    raise exception 'Kapak fotoğrafı medya ID''si bulunamadı: %', v_image_id;
  end if;

  for v_capacity in 1..7 loop
    v_slug := format('video-kurban-%s-kisilik-grup', v_capacity);
    v_title := format('%s Kişilik Kurban Video Grubu', v_capacity);
    if exists (select 1 from public.campaigns
               where slug = v_slug or code = v_slug) then
      if not exists (select 1 from public.campaigns
                     where slug = v_slug and code = v_slug
                       and group_capacity = v_capacity
                       and pricing_model = 'fixed'
                       and video_delivery = 'video') then
        raise exception 'Var olan bağış alanı beklenen video grubuyla eşleşmiyor: %', v_slug;
      end if;
      continue;
    end if;

    insert into public.campaigns (
      code, slug, category_id, image_id, currency,
      pricing_model, unit_price, unit_label, total_stock,
      video_delivery, operation_type, group_capacity,
      participant_required, message_template,
      slaughter_script, slaughter_script_version,
      status, is_donation_open, reporting_mode,
      consent_legal_review_required
    ) values (
      v_slug, v_slug, v_category_id, v_image_id, 'TRY',
      'fixed', v_prices[v_capacity], 'hisse', null,
      'video', 'slaughter_video', v_capacity,
      true,
      E'Sayın {ad},\n\nBağışınıza ait videonuz hazırlanmıştır. Rabbim hayrınızı kabul etsin.\n\nKampanya: {kampanya}\nGrup kodu: {grup_kodu}\nVideo bağlantısı: {video_linki}\nErişim kodu: {erisim_kodu}',
      v_slaughter_script, 1,
      'draft', false, 'pool', true
    ) returning id into v_campaign_id;

    insert into public.campaigns_locales (_parent_id, _locale, title)
    values (v_campaign_id, 'tr', v_title);
  end loop;
end
$seed$;

commit;

select c.id, cl.title, c.unit_price as hisse_fiyati_tl,
       c.group_capacity as kisi_sayisi, c.total_stock, c.status,
       c.image_id
from public.campaigns c
join public.campaigns_locales cl on cl._parent_id = c.id and cl._locale::text = 'tr'
where c.code like 'video-kurban-%-kisilik-grup'
order by c.group_capacity;
