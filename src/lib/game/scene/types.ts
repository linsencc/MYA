export type SceneCgPolicy = {
  explicit_hint?: string;
};

export type SceneVenue = {
  narrative_tone?: string;
  allow_risk_choices?: boolean;
  cg_policy?: SceneCgPolicy;
};

export type SceneUnlock = {
  min_chapter?: number;
  min_intimacy?: number;
  min_desire?: number;
  min_trust?: number;
  /** 这些 flag 键须为真值（truthy） */
  required_flag_keys?: string[];
  /** 若存在且为真值则禁止进入 */
  forbidden_flag_keys?: string[];
};

export type SceneRecord = {
  schema_version: number;
  id: string;
  display_name: string;
  aliases: string[];
  layout_pg_en: string;
  layout_nsfw_en?: string;
  variants_by_time?: Record<string, string>;
  venue?: SceneVenue;
  unlock?: SceneUnlock;
  /** 侧栏「前往」用 id，与客户端 travel 请求的 locationId 一致；省略则用场景 `id` */
  world_travel_id?: string;
  /** 列表展示名，缺省用 display_name */
  travel_label?: string;
  /** 侧栏地点排序，升序 */
  world_travel_order?: number;
  /** 地点卡缩略图，站点根下路径，如 `/scenes/office/bg_office.png` */
  world_cg_src?: string;
  /**
   * 按时段索引（0=清晨…5=晚上）覆盖背景图；优先级高于 world_cg_src。
   * 键为字符串化的 time_slot 数字（"0"~"5"）。
   */
  world_cg_by_time_slot?: Record<string, string>;
  /** 侧栏地点一句说明（氛围 / 用途） */
  world_card_summary?: string;
};

export type SceneRegistry = {
  scenesById: Map<string, SceneRecord>;
  /** 每项：最长 alias 优先匹配 */
  aliasEntries: { alias: string; id: string }[];
};
