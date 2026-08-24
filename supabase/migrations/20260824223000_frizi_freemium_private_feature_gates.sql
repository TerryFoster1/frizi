-- Harden Pro Free private feature boundaries after introducing public/basic booking.
-- Pro Free may be published, discoverable, and basically bookable, but CRM,
-- Hair Passport/photos, promotions, messaging automation, and value products are paid.

drop policy if exists "professionals can create CRM clients" on public.frizi_clients;
create policy "professionals can create CRM clients"
on public.frizi_clients
for insert
to authenticated
with check (
  created_by_professional_id = public.frizi_current_professional_id()
  and public.frizi_professional_has_capability(created_by_professional_id, 'canAccessCRM')
);

drop policy if exists "professionals can read their CRM clients" on public.frizi_clients;
create policy "professionals can read their CRM clients"
on public.frizi_clients
for select
to authenticated
using (
  profile_id in (select id from public.frizi_profiles where auth_user_id = (select auth.uid()))
  or (
    public.frizi_professional_has_capability(public.frizi_current_professional_id(), 'canAccessCRM')
    and (
      exists (
        select 1
        from public.frizi_client_professional_relationships rel
        where rel.client_id = frizi_clients.id
          and rel.professional_id = public.frizi_current_professional_id()
      )
      or created_by_professional_id = public.frizi_current_professional_id()
    )
  )
);

drop policy if exists "professionals can update their CRM clients" on public.frizi_clients;
create policy "professionals can update their CRM clients"
on public.frizi_clients
for update
to authenticated
using (
  public.frizi_professional_has_capability(public.frizi_current_professional_id(), 'canAccessCRM')
  and (
    created_by_professional_id = public.frizi_current_professional_id()
    or exists (
      select 1
      from public.frizi_client_professional_relationships rel
      where rel.client_id = frizi_clients.id
        and rel.professional_id = public.frizi_current_professional_id()
    )
  )
)
with check (
  public.frizi_professional_has_capability(public.frizi_current_professional_id(), 'canAccessCRM')
  and (
    created_by_professional_id = public.frizi_current_professional_id()
    or exists (
      select 1
      from public.frizi_client_professional_relationships rel
      where rel.client_id = frizi_clients.id
        and rel.professional_id = public.frizi_current_professional_id()
    )
  )
);

drop policy if exists "professionals can manage own CRM relationships" on public.frizi_client_professional_relationships;
create policy "professionals can manage own CRM relationships"
on public.frizi_client_professional_relationships
for all
to authenticated
using (
  professional_id = public.frizi_current_professional_id()
  and public.frizi_professional_has_capability(professional_id, 'canAccessCRM')
)
with check (
  professional_id = public.frizi_current_professional_id()
  and public.frizi_professional_has_capability(professional_id, 'canAccessCRM')
);

drop policy if exists "professionals can read connected client photos" on public.frizi_client_photos;
create policy "professionals can read connected client photos"
on public.frizi_client_photos
for select
to authenticated
using (
  public.frizi_professional_has_capability(public.frizi_current_professional_id(), 'canAccessConnectedHairProfiles')
  and (
    professional_id = public.frizi_current_professional_id()
    or exists (
      select 1
      from public.frizi_client_professional_relationships rel
      where rel.client_id = frizi_client_photos.client_id
        and rel.professional_id = public.frizi_current_professional_id()
        and rel.status = 'active'
    )
  )
);

drop policy if exists "professionals can manage own promotions" on public.frizi_promotions;
drop policy if exists "professionals can create own promotions" on public.frizi_promotions;
create policy "professionals can create own promotions"
on public.frizi_promotions
for insert
to authenticated
with check (
  salon_id is null
  and public.frizi_is_current_professional(created_by)
  and public.frizi_professional_has_capability(created_by, 'canCreatePromotions')
);

drop policy if exists "professionals can update own promotions" on public.frizi_promotions;
create policy "professionals can update own promotions"
on public.frizi_promotions
for update
to authenticated
using (
  salon_id is null
  and public.frizi_is_current_professional(created_by)
  and public.frizi_professional_has_capability(created_by, 'canCreatePromotions')
)
with check (
  salon_id is null
  and public.frizi_is_current_professional(created_by)
  and public.frizi_professional_has_capability(created_by, 'canCreatePromotions')
);

drop policy if exists "professionals can manage own campaigns" on public.frizi_campaigns;
create policy "professionals can manage own campaigns"
on public.frizi_campaigns
for all
to authenticated
using (
  professional_id = public.frizi_current_professional_id()
  and public.frizi_professional_has_capability(professional_id, 'canUseMarketingAutomation')
)
with check (
  professional_id = public.frizi_current_professional_id()
  and public.frizi_professional_has_capability(professional_id, 'canUseMarketingAutomation')
);

drop policy if exists "professionals can manage own campaign audiences" on public.frizi_campaign_audience_members;
create policy "professionals can manage own campaign audiences"
on public.frizi_campaign_audience_members
for all
to authenticated
using (
  public.frizi_professional_has_capability(public.frizi_current_professional_id(), 'canUseMarketingAutomation')
  and exists (
    select 1 from public.frizi_campaigns campaign
    where campaign.id = frizi_campaign_audience_members.campaign_id
      and campaign.professional_id = public.frizi_current_professional_id()
  )
)
with check (
  public.frizi_professional_has_capability(public.frizi_current_professional_id(), 'canUseMarketingAutomation')
  and exists (
    select 1
    from public.frizi_campaigns campaign
    join public.frizi_client_professional_relationships rel on rel.id = frizi_campaign_audience_members.relationship_id
    where campaign.id = frizi_campaign_audience_members.campaign_id
      and campaign.professional_id = public.frizi_current_professional_id()
      and rel.professional_id = campaign.professional_id
  )
);

drop policy if exists "public can read active value products" on public.frizi_value_products;
create policy "public can read active value products"
on public.frizi_value_products
for select
to anon, authenticated
using (
  status = 'active'
  and (
    salon_id is not null
    or (
      professional_id is not null
      and (
        (product_kind in ('gift_card', 'service_gift') and public.frizi_professional_has_capability(professional_id, 'canCreateGiftCards'))
        or (product_kind = 'package' and public.frizi_professional_has_capability(professional_id, 'canCreatePackages'))
        or (product_kind = 'membership' and public.frizi_professional_has_capability(professional_id, 'canCreateMemberships'))
      )
    )
  )
);

drop policy if exists "professionals can manage own value products" on public.frizi_value_products;
create policy "professionals can manage own value products"
on public.frizi_value_products
for all
to authenticated
using (
  professional_id = public.frizi_current_professional_id()
  and (
    (product_kind in ('gift_card', 'service_gift') and public.frizi_professional_has_capability(professional_id, 'canCreateGiftCards'))
    or (product_kind = 'package' and public.frizi_professional_has_capability(professional_id, 'canCreatePackages'))
    or (product_kind = 'membership' and public.frizi_professional_has_capability(professional_id, 'canCreateMemberships'))
  )
)
with check (
  professional_id = public.frizi_current_professional_id()
  and (
    (product_kind in ('gift_card', 'service_gift') and public.frizi_professional_has_capability(professional_id, 'canCreateGiftCards'))
    or (product_kind = 'package' and public.frizi_professional_has_capability(professional_id, 'canCreatePackages'))
    or (product_kind = 'membership' and public.frizi_professional_has_capability(professional_id, 'canCreateMemberships'))
  )
);
