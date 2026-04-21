-- =============================================================================
-- LCD TOOL — Migration 011 : Agenda & Tâches (TickTick-inspired)
-- Tables  : task_lists, tasks
-- =============================================================================


-- =============================================================================
-- TABLE : task_lists  (projets / listes personnalisées)
-- =============================================================================

CREATE TABLE IF NOT EXISTS task_lists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  color       text        NOT NULL DEFAULT '#1D9E75',
  icon        text        NOT NULL DEFAULT 'list',
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE task_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_task_lists" ON task_lists FOR ALL USING (true);


-- =============================================================================
-- TABLE : tasks
-- =============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text        NOT NULL,
  description       text,
  category          text
    CHECK (category IN (
      'voyageur','menage','maintenance','commercial',
      'administratif','proprietaire','equipe','personnel','autre'
    )),
  priority          text        DEFAULT 'neither'
    CHECK (priority IN ('urgent_important','important','urgent','neither')),
  status            text        NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo','in_progress','done','cancelled','deferred')),
  due_date          date,
  due_time          time,
  reminder_at       timestamptz,
  task_list_id      uuid        REFERENCES task_lists(id) ON DELETE SET NULL,
  property_id       uuid        REFERENCES properties(id) ON DELETE SET NULL,
  reservation_id    uuid        REFERENCES reservations(id) ON DELETE SET NULL,
  lead_id           uuid        REFERENCES crm_leads(id) ON DELETE SET NULL,
  incident_id       uuid        REFERENCES incidents(id) ON DELETE SET NULL,
  assigned_to       uuid,
  created_by        uuid,
  tags              text[]      NOT NULL DEFAULT '{}',
  recurrence        text        NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none','daily','weekly','monthly','custom')),
  recurrence_config jsonb,
  parent_task_id    uuid        REFERENCES tasks(id) ON DELETE CASCADE,
  sort_order        int         NOT NULL DEFAULT 0,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_due_date     ON tasks(due_date);
CREATE INDEX idx_tasks_priority     ON tasks(priority);
CREATE INDEX idx_tasks_status       ON tasks(status);
CREATE INDEX idx_tasks_category     ON tasks(category);
CREATE INDEX idx_tasks_list         ON tasks(task_list_id);
CREATE INDEX idx_tasks_property     ON tasks(property_id);
CREATE INDEX idx_tasks_reservation  ON tasks(reservation_id);
CREATE INDEX idx_tasks_lead         ON tasks(lead_id);
CREATE INDEX idx_tasks_parent       ON tasks(parent_task_id);

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_tasks" ON tasks FOR ALL USING (true);


-- =============================================================================
-- DONNÉES INITIALES : listes système
-- =============================================================================

INSERT INTO task_lists (name, color, icon, sort_order) VALUES
  ('Voyageurs & Logements', '#1D9E75', 'home',       1),
  ('Commercial & CRM',      '#2563EB', 'trending-up', 2),
  ('Équipe & Ménage',       '#D97706', 'users',       3),
  ('Maintenance & SAV',     '#EA580C', 'wrench',      4),
  ('Administratif',         '#7C3AED', 'file-text',   5),
  ('Personnel',             '#6B7280', 'user',        6)
ON CONFLICT DO NOTHING;
