import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import type { CustomizedResume } from "../types";

export function downloadAsText(rawText: string, filename = "tailored-resume.txt") {
  const blob = new Blob([rawText], { type: "text/plain;charset=utf-8" });
  saveAs(blob, filename);
}

export async function downloadAsDocx(
  resume: CustomizedResume,
  filename = "tailored-resume.docx"
) {
  const children: Paragraph[] = [];

  if (resume.summary) {
    children.push(new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: resume.summary }));
  }

  if (resume.skills?.length) {
    children.push(new Paragraph({ text: "Skills", heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: resume.skills.join(", ") }));
  }

  if (resume.experience?.length) {
    children.push(new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_2 }));
    resume.experience.forEach((e) => {
      const header = [e.title, e.company, e.dates].filter(Boolean).join(" — ");
      if (header) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: header, bold: true })] })
        );
      }
      e.bullets?.forEach((b) => {
        children.push(new Paragraph({ text: b, bullet: { level: 0 } }));
      });
    });
  }

  if (resume.education?.length) {
    children.push(new Paragraph({ text: "Education", heading: HeadingLevel.HEADING_2 }));
    resume.education.forEach((ed) => children.push(new Paragraph({ text: ed })));
  }

  if (resume.certifications?.length) {
    children.push(new Paragraph({ text: "Certifications", heading: HeadingLevel.HEADING_2 }));
    resume.certifications.forEach((c) => children.push(new Paragraph({ text: c })));
  }

  if (resume.projects?.length) {
    children.push(new Paragraph({ text: "Projects", heading: HeadingLevel.HEADING_2 }));
    resume.projects.forEach((p) => children.push(new Paragraph({ text: p })));
  }

  if (resume.other_sections?.length) {
    children.push(new Paragraph({ text: "Additional", heading: HeadingLevel.HEADING_2 }));
    resume.other_sections.forEach((o) => children.push(new Paragraph({ text: o })));
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}
