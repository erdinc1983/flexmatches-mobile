CREATE OR REPLACE FUNCTION get_inbox(p_user_id uuid)
RETURNS TABLE (
  match_id            uuid,
  match_updated_at    timestamptz,
  other_user_id       uuid,
  other_username      text,
  other_full_name     text,
  other_avatar_url    text,
  last_message        text,
  last_message_at     timestamptz,
  unread_count        bigint,
  session_id          uuid,
  session_proposer_id uuid,
  session_receiver_id uuid,
  session_sport       text,
  session_date        text,
  session_time        text,
  session_location    text,
  session_notes       text,
  session_status      text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    m.id                    AS match_id,
    m.updated_at            AS match_updated_at,
    other.id                AS other_user_id,
    other.username          AS other_username,
    other.full_name         AS other_full_name,
    other.avatar_url        AS other_avatar_url,
    lm.content              AS last_message,
    lm.created_at           AS last_message_at,
    COALESCE(unread.cnt, 0) AS unread_count,
    bs.id                   AS session_id,
    bs.proposer_id          AS session_proposer_id,
    bs.receiver_id          AS session_receiver_id,
    bs.sport                AS session_sport,
    bs.session_date         AS session_date,
    bs.session_time         AS session_time,
    bs.location             AS session_location,
    bs.notes                AS session_notes,
    bs.status               AS session_status
  FROM matches m
  JOIN users other
    ON other.id = CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END
  LEFT JOIN LATERAL (
    SELECT content, created_at
    FROM messages
    WHERE match_id = m.id
    ORDER BY created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM messages
    WHERE match_id = m.id
      AND sender_id != p_user_id
      AND read_at IS NULL
  ) unread ON true
  LEFT JOIN LATERAL (
    SELECT id, proposer_id, receiver_id, sport, session_date, session_time, location, notes, status
    FROM buddy_sessions
    WHERE match_id = m.id
      AND status NOT IN ('declined', 'cancelled', 'completed')
    ORDER BY session_date ASC
    LIMIT 1
  ) bs ON true
  WHERE m.status = 'accepted'
    AND (m.sender_id = p_user_id OR m.receiver_id = p_user_id)
    AND other.banned_at IS NULL
  ORDER BY m.updated_at DESC;
$$;
