import { parseDescriptionSections } from "@/lib/listings/render-sections";

export default function DescriptionSections({ description }: { description: string }) {
  const sections = parseDescriptionSections(description);

  return (
    <>
      {sections.map((section, i) => (
        <div key={i} className={i > 0 ? "mt-5" : undefined}>
          {section.heading && (
            <h3 className="text-base font-semibold text-gray-900 mb-2">{section.heading}</h3>
          )}
          {section.body && (
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{section.body}</p>
          )}
        </div>
      ))}
    </>
  );
}
