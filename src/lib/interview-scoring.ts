export const INTERVIEW_SCORING_CRITERIA = [
  { key: "mannerAppearance", label: "Manner and Appearance", description: "Confidence, posture, eye contact, body movement, enthusiasm" },
  { key: "communicationSkills", label: "Communication Skills", description: "Fluency, clarity, listening, and command of language" },
  { key: "jobKnowledge", label: "Job Knowledge", description: "Understanding of the role and subject area" },
  { key: "workExperience", label: "Work Experience", description: "Relevant experience in the field" },
  { key: "leadershipPotential", label: "Leadership Potentials", description: "Initiative, adaptability, decisions, and ability to motivate others" },
  { key: "selfManagement", label: "Self-Management", description: "Prioritization, rapport, resourcefulness, and stress management" },
  { key: "professionalism", label: "Professionalism", description: "Responsibility, tact, integrity, and respect" },
  { key: "interpersonalSkills", label: "Interpersonal Skills", description: "Ability to relate well with colleagues and applicants" },
  { key: "valuesCultureFit", label: "Values & Culture Fit", description: "Alignment with the university's values" },
  { key: "motivationCommitment", label: "Motivation & Commitment", description: "Interest in the role and commitment to staying and contributing" },
] as const;

export const INTERVIEW_RATING_LABELS = ["Poor", "Fair", "Good", "Very Good", "Excellent"] as const;

export type InterviewCriterionKey = typeof INTERVIEW_SCORING_CRITERIA[number]["key"];
export type InterviewRecommendation = "Highly Recommended" | "Recommended" | "Recommended with Reservation" | "Not Recommended";

export function recommendationForScore(total: number): InterviewRecommendation {
  if (total >= 81) return "Highly Recommended";
  if (total >= 61) return "Recommended";
  if (total >= 41) return "Recommended with Reservation";
  return "Not Recommended";
}
