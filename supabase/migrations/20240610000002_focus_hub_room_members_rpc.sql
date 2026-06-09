-- Room member list with profile fields (bypasses profiles RLS for co-members).

CREATE OR REPLACE FUNCTION public.get_focus_hub_room_members(p_room_id uuid)
RETURNS TABLE (
  user_id    uuid,
  role       text,
  joined_at  timestamptz,
  name       text,
  avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    m.user_id,
    m.role,
    m.joined_at,
    coalesce(p.display_name, p.name, 'User') AS name,
    p.avatar_url
  FROM public.focus_hub_memberships m
  JOIN public.profiles p ON p.id = m.user_id
  WHERE m.room_id = p_room_id
    AND (
      public.is_focus_hub_member(p_room_id)
      OR public.is_focus_hub_host(p_room_id)
    )
  ORDER BY m.role ASC, m.joined_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_focus_hub_room_members(uuid) TO authenticated;
