-- Meta Ads — AI Audit-Felder (Increment A), rein additiv. Kein DROP.
ALTER TABLE ma_ai_analysis ADD COLUMN IF NOT EXISTS reasoning_effort          VARCHAR(10);
ALTER TABLE ma_ai_analysis ADD COLUMN IF NOT EXISTS prompt_version            VARCHAR(20);
ALTER TABLE ma_ai_analysis ADD COLUMN IF NOT EXISTS strategy_version          VARCHAR(20);
ALTER TABLE ma_ai_analysis ADD COLUMN IF NOT EXISTS input_tokens              INTEGER;
ALTER TABLE ma_ai_analysis ADD COLUMN IF NOT EXISTS output_tokens             INTEGER;
ALTER TABLE ma_ai_analysis ADD COLUMN IF NOT EXISTS reasoning_tokens          INTEGER;
ALTER TABLE ma_ai_analysis ADD COLUMN IF NOT EXISTS latency_ms                INTEGER;
ALTER TABLE ma_ai_analysis ADD COLUMN IF NOT EXISTS retry_count               INTEGER;
ALTER TABLE ma_ai_analysis ADD COLUMN IF NOT EXISTS data_confidence           VARCHAR(10);
ALTER TABLE ma_ai_analysis ADD COLUMN IF NOT EXISTS recommendation_confidence VARCHAR(10);
