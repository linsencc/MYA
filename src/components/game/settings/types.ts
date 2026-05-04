import type { TeacherWear, TeacherWearNsfw } from "@/lib/game/domain/teacher-wear";

export type GalleryItem = { name: string; url: string };

export type GodForm = {
  affection: number;
  trust: number;
  intimacy: number;
  desire: number;
  chapter: number;
  coldWar: number;
  calendarDay: number;
  timeSlot: number;
  mood: string;
  location: string;
  wear: TeacherWear;
  wearNsfw: TeacherWearNsfw;
  timeOfDay: string;
  relationship: string;
};
