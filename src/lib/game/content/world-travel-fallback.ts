/** 无 Node/fs 依赖；与 content/scenes 中 world_travel 配置保持 id 一致 */

import { sceneCgDefaultUrl } from "@/lib/game/cg/scene-url";

export type TravelLocationDefFallback = {
  id: string;
  label: string;
  cgImageSrc: string | null;
  cardSummary: string;
};

export const FALLBACK_TRAVEL_LOCATION_DEFS: TravelLocationDefFallback[] = [
  {
    id: "classroom",
    label: "教室",
    cgImageSrc: sceneCgDefaultUrl("classroom"),
    cardSummary: "日照与粉笔灰的日常轴心；傍晚留室时斜阳与空椅让沉默更烫。",
  },
  {
    id: "teacher_office",
    label: "教师办公室",
    // travel id 与场景目录 id (office) 不同，单独指向 office 目录底图
    cgImageSrc: sceneCgDefaultUrl("office"),
    cardSummary: "纸张与咖啡香：试探、分寸与「能不能关门」的微妙拉扯。",
  },
  {
    id: "corridor",
    label: "教学楼走廊",
    // travel id 与场景目录 id (hallway) 不同，单独指向 hallway 目录底图
    cgImageSrc: sceneCgDefaultUrl("hallway"),
    cardSummary: "人来人往的过渡带：一句话、一眼神都要算好音量与距离。",
  },
  {
    id: "rooftop",
    label: "天台",
    cgImageSrc: sceneCgDefaultUrl("rooftop"),
    cardSummary: "栏杆与风声：台词再轻也会被心跳盖过去。",
  },
];
