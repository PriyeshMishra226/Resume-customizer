export interface ExperienceEntry {
  title: string;
  company: string;
  dates: string;
  bullets: string[];
}

export interface CustomizedResume {
  summary: string;
  skills: string[];
  experience: ExperienceEntry[];
  education: string[];
  certifications: string[];
  projects: string[];
  other_sections: string[];
}

export interface CustomizeResponse {
  customized_resume: CustomizedResume;
  match_score: number;
  missing_keywords: string[];
  notes?: string | null;
  raw_text: string;
}
