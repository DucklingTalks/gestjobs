import { writeFileSync } from "node:fs";

import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";

import { tailoredCvSchema } from "@/lib/ai/fit";
import { cvLinks } from "@/lib/cv/format";
import { cvFileName, renderCvPdf } from "@/lib/cv/pdf";

const cv = tailoredCvSchema.parse({
  headline: "Desarrolladora Frontend Senior",
  summary:
    "Ingeniera de software con 7 años construyendo productos web con React y TypeScript. Lideré migraciones a Next.js y equipos de 4 personas.",
  skills: ["React", "TypeScript", "Next.js", "Node.js", "PostgreSQL", "Accesibilidad (WCAG)"],
  experiences: [
    {
      company: "Acme Pagos",
      title: "Frontend Lead",
      location: "Montevideo",
      startDate: "2021-03",
      current: true,
      bullets: [
        "Lideré la migración del checkout a Next.js, reduciendo el tiempo de carga un 40 %.",
        "Diseñé un sistema de componentes accesible usado por 6 equipos “product”.",
      ],
    },
    {
      company: "Globant",
      title: "Desarrolladora React",
      startDate: "2018-01",
      endDate: "2021-02",
      bullets: ["Implementé paneles de analítica en tiempo real para clientes de retail 🚀."],
    },
  ],
  education: [
    { institution: "Universidad de la República", degree: "Ingeniería en Computación", startDate: "2012", endDate: "2017" },
  ],
  languages: [{ language: "Español", level: "Nativo" }, { language: "Inglés", level: "C1" }],
  certifications: [{ name: "AWS Certified Developer", issuer: "Amazon", year: "2023" }],
});

const contact = {
  fullName: "Ana Pérez Núñez",
  email: "ana@example.com",
  phone: "+598 99 123 456",
  location: "Montevideo, Uruguay",
  links: [
    { label: "LinkedIn", url: "https://www.linkedin.com/in/anaperez/" },
    { label: "GitHub", url: "github.com/anaperez" },
    { label: "Portfolio", url: "https://anaperez.dev/" },
  ],
};

describe("renderCvPdf (ATS readability)", () => {
  it("produces extractable text in reading order with accents preserved", async () => {
    const bytes = await renderCvPdf({ cv, contact, language: "es", jobTitle: "Frontend Lead" });
    if (process.env.CV_PDF_OUT) writeFileSync(process.env.CV_PDF_OUT, bytes);

    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });

    expect(totalPages).toBe(1);
    for (const expected of [
      "Ana Pérez Núñez",
      "ana@example.com",
      "+598 99 123 456",
      "PERFIL PROFESIONAL",
      "EXPERIENCIA",
      "Frontend Lead - Acme Pagos",
      "Mar 2021 – Actualidad",
      "Lideré la migración del checkout a Next.js",
      "EDUCACIÓN",
      "Ingeniería en Computación",
      "HABILIDADES",
      "Accesibilidad (WCAG)",
      "IDIOMAS",
      "Inglés - C1",
      "CERTIFICACIONES",
    ]) {
      expect(text).toContain(expected);
    }

    // Sections must come out top-to-bottom (single column).
    const order = ["PERFIL PROFESIONAL", "EXPERIENCIA", "EDUCACIÓN", "HABILIDADES", "IDIOMAS", "CERTIFICACIONES"].map(
      (heading) => text.indexOf(heading),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // Unencodable characters (emoji) are dropped instead of breaking the file.
    expect(text).not.toContain("🚀");
  });

  it("prints each link with its label and makes it clickable", async () => {
    const bytes = await renderCvPdf({ cv, contact, language: "es", jobTitle: "Frontend Lead" });
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });

    expect(text).toContain("LinkedIn: linkedin.com/in/anaperez");
    expect(text).toContain("GitHub: github.com/anaperez");
    expect(text).toContain("Portfolio: anaperez.dev");

    const annotations = await (await pdf.getPage(1)).getAnnotations();
    const urls = annotations.filter((a) => a.subtype === "Link").map((a) => a.url);
    expect(urls).toEqual([
      "https://www.linkedin.com/in/anaperez/",
      "https://github.com/anaperez",
      "https://anaperez.dev/",
    ]);
  });

  it("builds a safe file name", () => {
    expect(cvFileName("Ana Pérez", "Frontend / Lead")).toBe("Ana Perez - Frontend Lead - CV.pdf");
    expect(cvFileName("", "")).toBe("CV.pdf");
  });
});

describe("cvLinks", () => {
  it("keeps the address visible and drops protocol, www and trailing slash", () => {
    expect(cvLinks([{ label: "LinkedIn", url: "https://www.linkedin.com/in/ana/" }])).toEqual([
      { text: "LinkedIn: linkedin.com/in/ana", href: "https://www.linkedin.com/in/ana/" },
    ]);
  });

  it("falls back to the address when there is no label and skips blank URLs", () => {
    expect(cvLinks([{ label: "", url: "ana.dev" }, { label: "Empty", url: "  " }])).toEqual([
      { text: "ana.dev", href: "https://ana.dev/" },
    ]);
  });

  it("never links non-http schemes", () => {
    expect(cvLinks([{ label: "Bad", url: "javascript:alert(1)" }])).toEqual([
      { text: "Bad: javascript:alert(1)", href: null },
    ]);
  });
});
